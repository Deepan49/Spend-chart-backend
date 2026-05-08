const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mailer = require('../utils/mailer');
const axios = require('axios');

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email or phone' });
    }

    const user = new User({ name, email, password, phone });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    
    await user.save();

    mailer.sendOTP(user.email, otp).catch(err => {
      console.error('[AUTH] Email sending failed:', err.message);
    });

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful. OTP sent to your email.' 
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
  try {
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    mailer.sendOTP(user.email, otp).catch(err => {
      console.error('[AUTH] sendOTP email failed:', err.message);
    });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
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
      message: 'Profile updated successfully',
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
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    mailer.sendOTP(user.email, otp).catch(err => {
      console.error('[AUTH] Forgot password email failed:', err.message);
    });

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

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    
    if (!idToken && !accessToken) {
      return res.status(400).json({ success: false, message: 'No token provided' });
    }

    let userData;

    if (idToken) {
      // Verify ID Token
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      userData = {
        googleId: response.data.sub,
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture
      };
    } else {
      // Fallback: Verify Access Token
      const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
      userData = {
        googleId: response.data.sub,
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture
      };
    }

    const { googleId, email, name, picture } = userData;
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        googleId,
        profilePicture: picture,
        isVerified: true
      });
      await user.save();
    } else {
      // Update googleId if not present
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.profilePicture) user.profilePicture = picture;
        await user.save();
      }
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
    res.status(401).json({ success: false, message: 'Google authentication failed: ' + err.message });
  }
};

