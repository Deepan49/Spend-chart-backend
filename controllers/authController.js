const User = require('../models/User');
const jwt = require('jsonwebtoken');

const mailer = require('../utils/mailer');

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email or phone' });
    }

    // Create user
    const user = new User({ name, email, password, phone });
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    
    await user.save();

    // Send OTP via Email
    try {
      await mailer.sendOTP(user.email, otp);
      console.log(`[AUTH] OTP ${otp} sent to ${email}`);
    } catch (mailError) {
      console.error('[AUTH] Email sending failed during registration:', mailError.message);
    }

    // Mock WhatsApp (Console log for now)
    console.log(`[WHATSAPP] To ${user.phone}: Your registration code is ${otp}`);

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful. OTP sent to your email and WhatsApp.' 
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.sendOTP = async (req, res) => {
  const { email, phone } = req.body;
  console.log(`[AUTH] sendOTP requested for: ${email || phone}`);
  try {
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user) {
      console.log(`[AUTH] sendOTP failed: User not found for ${email || phone}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // 1. Send via Gmail
    try {
      await mailer.sendOTP(user.email, otp);
    } catch (mailError) {
      console.error('[AUTH] Email sending failed, but continuing with mock WhatsApp:', mailError.message);
    }

    // 2. Mock WhatsApp (Console log for now)
    console.log(`[WHATSAPP] To ${user.phone}: Your code is ${otp}`);

    res.json({ success: true, message: 'OTP sent to your email and WhatsApp' });
  } catch (err) {
    console.error(`[AUTH] sendOTP error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone, otp, otpExpires: { $gt: Date.now() } });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ 
      success: true,
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, profilePicture } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (profilePicture) user.profilePicture = profilePicture;
    await user.save();

    res.json({ 
      success: true,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    try {
      await mailer.sendOTP(user.email, otp);
    } catch (mailError) {
      console.error('[AUTH] Forgot password email failed:', mailError.message);
    }

    res.json({ success: true, message: 'Password reset OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ 
      email, 
      otp, 
      otpExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
