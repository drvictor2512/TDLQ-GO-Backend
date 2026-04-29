require("dotenv").config();
const nodemailer = require("nodemailer");

let transporter;
try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} catch (error) {
  console.warn("Email transporter not configured:", error.message);
}

const sendVerificationEmail = async (email, token) => {
  const link = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify your email",
    html: `<p>Nhấn vào link để kích hoạt tài khoản: <a href="${link}">${link}</a></p>`,
  };

  if (!transporter) {
    console.log("Email transporter not configured. Verification link:", link);
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent");
  } catch (error) {
    console.error("Error sending email:", error);
    console.log("Verification link (fallback):", link);
  }
};

const sendResetPasswordEmail = async (email, token) => {
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Đặt lại mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p>Nhấn vào nút bên dưới để đặt lại mật khẩu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p style="color: #666; font-size: 14px;">Link sẽ hết hạn sau 15 phút.</p>
        <p style="color: #666; font-size: 14px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };

  if (!transporter) {
    console.log("Email transporter not configured. Reset password link:", link);
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log("Reset password email sent to:", email);
  } catch (error) {
    console.error("Error sending reset password email:", error);
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
};
