const express = require("express");
const router = express.Router();
const { getReviews, createReview } = require("../controllers/review.controller");

router.get("/products/:id/reviews", getReviews);
router.post("/products/:id/reviews", createReview);

module.exports = router;
