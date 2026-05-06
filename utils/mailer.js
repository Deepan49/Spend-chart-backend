const axios = require('axios');

exports.sendOTP = async (email, otp) => {
  console.log(`[MAILER] Attempting to send OTP via Resend to: ${email}`);
  
  if (!process.env.RESEND_API_KEY) {
    console.error('[MAILER] RESEND_API_KEY is missing!');
    throw new Error('Email service configuration missing');
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: 'Spend Chart <onboarding@resend.dev>',
        to: email,
        subject: 'Your Verification Code',
        html: `<h3>Security Code</h3><p>Your verification code is: <b>${otp}</b></p>`,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[MAILER] Email sent successfully via Resend: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`[MAILER] Resend API error: ${error.response?.data?.message || error.message}`);
    throw error;
  }
};
