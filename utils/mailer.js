const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Extra settings to help with Render timeouts
  connectionTimeout: 10000, 
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

exports.sendOTP = async (email, otp) => {
  console.log(`[MAILER] Attempting to send branded Gmail OTP to: ${email}`);
  
  const mailOptions = {
    from: `"Spend Chart" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `[Spend Chart] ${otp} is your verification code`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #00008B; text-align: center;">Spend Chart</h2>
        <hr style="border: 0; border-top: 1px solid #eee;">
        <p>Hello,</p>
        <p>Use the following code to verify your account. It will expire in 10 minutes.</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #00008B;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #888; text-align: center; margin-top: 30px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Branded Gmail sent: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`[MAILER] Gmail error: ${error.message}`);
    throw error;
  }
};
