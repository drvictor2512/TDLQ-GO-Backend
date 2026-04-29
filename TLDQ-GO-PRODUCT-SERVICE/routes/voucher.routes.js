const express = require("express");
const router = express.Router();

const {
  createVoucher,
  getVouchersBySeller,
  updateVoucher,
  deleteVoucher,
} = require("../controllers/voucher.controller");

router.post("/vouchers", createVoucher);
router.put("/vouchers/:id", updateVoucher);
router.delete("/vouchers/:id", deleteVoucher);
router.get("/vouchers/seller/:seller_id", getVouchersBySeller);

module.exports = router;
