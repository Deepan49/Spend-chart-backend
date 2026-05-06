const axios = require('axios');

exports.sendOTP = async (email, otp) => {
  console.log(`[MAILER] Sending branded OTP via Resend to: ${email}`);
  
  if (!process.env.RESEND_API_KEY) {
    console.error('[MAILER] RESEND_API_KEY is missing!');
    throw new Error('Email configuration missing');
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: 'Spend Chart <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Spend Chart Verification Code',
        html: `<h3>Spend Chart Security</h3><p>Your verification code is: <b>${otp}</b></p><p>This code expires in 10 minutes.</p>`,
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
    console.error(`[MAILER] Error sending email: ${error.response?.data?.message || error.message}`);
    throw error;
  }
};
