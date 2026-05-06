const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // This forces the connection to use IPv4
    rejectUnauthorized: false
  }
});

exports.sendOTP = async (email, otp) => {
  console.log(`[MAILER] Attempting to send OTP to: ${email}`);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your SD-Track Verification Code',
    text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
    html: `<h3>SD-Track Security</h3><p>Your verification code is: <b>${otp}</b></p><p>This code expires in 10 minutes.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Email sent successfully: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`[MAILER] Error sending email: ${error.message}`);
    throw error;
  }
};
