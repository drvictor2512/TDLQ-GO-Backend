const Order = require("../models/order.model");

exports.createOrder = async (req, res) => {
  try {
    const {
      customer_id,
      items,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items cannot be empty" });
    }

    // 1. Validate customer via User Service
    const userRes = await fetch(
      `http://user-service:3001/users/${customer_id}`,
    );
    if (!userRes.ok) {
      return res
        .status(400)
        .json({ message: "Invalid customer_id or user not found" });
    }

    // 2. Fetch products and calculate total_amount directly from source
    let total_amount = 0;
    const validatedItems = [];
    let detected_seller_id = req.body.seller_id || null;

    for (const item of items) {
      const productRes = await fetch(
        `http://product-service:3002/products/${item.product_id}`,
      );
      if (!productRes.ok) {
        return res
          .status(400)
          .json({ message: `Product ${item.product_id} not found` });
      }

      const productData = await productRes.json();
      const product = productData.data;

      // Assign global seller_id from first product if not provided
      if (!detected_seller_id) {
        detected_seller_id = product.seller_id;
      }

      // Store validated item to prevent price tampering
      validatedItems.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
      });

      total_amount += item.quantity * product.price;
    }

    const newOrder = await Order.create({
      customer_id,
      seller_id: detected_seller_id || "system",
      items: validatedItems,
      total_amount,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method,
    });

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
