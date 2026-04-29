const express = require("express");
const router = express.Router();

const {
  createVoucher,
  getVouchersBySeller,
} = require("../controllers/voucher.controller");

router.post("/vouchers", createVoucher);
router.get("/vouchers/seller/:seller_id", getVouchersBySeller);

module.exports = router;
