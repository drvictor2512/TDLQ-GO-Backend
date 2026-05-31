const express = require("express");
const router = express.Router();
const multer = require("multer");
const { getReviews, createReview, getSellerReviews } = require("../controllers/review.controller");

const upload = multer({ storage: multer.memoryStorage() });

router.get("/products/seller/:seller_id/reviews", getSellerReviews);
router.get("/products/:id/reviews", getReviews);
router.post("/products/:id/reviews", upload.array("images", 5), createReview);

module.exports = router;
