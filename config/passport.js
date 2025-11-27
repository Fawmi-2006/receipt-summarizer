const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth profile received for:', profile.emails[0].value);
    
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      console.log('Existing Google user found, updating login info');
      // Update last login and login count without triggering middleware
      await User.findByIdAndUpdate(user._id, {
        lastLogin: new Date(),
        loginCount: (user.loginCount || 0) + 1,
        updatedAt: new Date()
      });
      
      // Refetch the updated user
      user = await User.findById(user._id);
      return done(null, user);
    }
    
    // Check if user exists with same email
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      console.log('Linking Google account to existing user');
      // Link Google account to existing email account without triggering middleware
      await User.findByIdAndUpdate(user._id, {
        googleId: profile.id,
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : user.avatar,
        lastLogin: new Date(),
        loginCount: (user.loginCount || 0) + 1,
        updatedAt: new Date()
      });
      
      // Refetch the updated user
      user = await User.findById(user._id);
      return done(null, user);
    }
    
    // Check if this is the admin email
    const isAdmin = profile.emails[0].value === 'fawmijailabdeen@gmail.com';
    
    // Create new user - use create instead of save to avoid middleware
    console.log('Creating new Google OAuth user');
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
      role: isAdmin ? 'admin' : 'user',
      lastLogin: new Date(),
      loginCount: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`New ${isAdmin ? 'admin' : 'user'} created successfully`);
    done(null, user);
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    console.error('Error stack:', error.stack);
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});