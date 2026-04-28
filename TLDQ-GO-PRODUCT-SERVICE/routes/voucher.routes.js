const express = require("express");
const router = express.Router();

const { createVoucher } = require("../controllers/voucher.controller");

router.post("/vouchers", createVoucher);

module.exports = router;
