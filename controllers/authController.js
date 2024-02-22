const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');

const User = require('../models/userModel');
const asyncCatch = require('../utils/asyncCatch');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user.id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forward-proto' == 'https'],
  };

  user.password = undefined;

  res.cookie('JWT', token, cookieOptions);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = asyncCatch(async (req, res, next) => {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    // passwordChangedAt: req.body.passwordChangedAt,
    // role: req.body.role,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(user, url).sendWelcome();

  createSendToken(user, 201, req, res);
});

exports.login = asyncCatch(async (req, res, next) => {
  const { email, password } = req.body;
  // 1 - check email and password
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  // 2 - check email exist and password
  const user = await User.findOne({ email: email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Invalid email or password', 400));
  }

  // 3- send token
  createSendToken(user, 200, req, res);
});

exports.protect = asyncCatch(async (req, res, next) => {
  // 1- check if token exist
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.JWT) {
    token = req.cookies.JWT;
  }

  if (!token) {
    return next(
      new AppError('your are not logged in, please login to gain access', 401),
    );
  }

  // 2- check if token is valid
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('invalid token was sent', 401));
  }

  // 3- check if user still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('user linked to this token no longer exist', 401));
  }

  // 4- check if password changed after token creation
  if (currentUser.passwordChangeAfter(decoded.iat)) {
    return next(new AppError('password changed, please login again', 401));
  }

  // allow access to protected route
  req.user = currentUser;
  res.locals.user = currentUser;

  next();
});

exports.restrictTo = function (...roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role)) {
      next(
        new AppError("you don't have permission to preform this action", 403),
      );
    }
    next();
  };
};

exports.forgotPassword = asyncCatch(async (req, res, next) => {
  // 1- check if user exist

  const currentUser = await User.findOne({ email: req.body.email });
  if (!currentUser) {
    return next(new AppError('user not found', 404));
  }
  // 2 - create token

  const token = currentUser.createPasswordResetToken();
  await currentUser.save({ validateBeforeSave: false });
  // validateModifiedOnly: true

  // 3 -send email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/${token}`;
    await new Email(currentUser, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'token sent to email',
    });
  } catch (err) {
    currentUser.passwordResetToken = undefined;
    currentUser.passwordResetExpires = undefined;
    await currentUser.save({ validateBeforeSave: false });

    next(new AppError("couldn't reset password , please try again", 500));
  }
});
exports.resetPassword = asyncCatch(async (req, res, next) => {
  // 1- get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // 2- check if user exist and token is valid . and set password
  const currentUser = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gte: Date.now() },
  });

  if (!currentUser) {
    next(new AppError(' token is invalid or has expired', 400));
  }
  currentUser.password = req.body.password;
  currentUser.confirmPassword = req.body.confirmPassword;
  currentUser.passwordResetExpires = undefined;
  currentUser.passwordResetToken = undefined;
  await currentUser.save();
  // 3- update changePasswordAt

  //  4- log user in
  createSendToken(currentUser, 200, req, res);
});

exports.updatePassword = asyncCatch(async (req, res, next) => {
  // 1- get user from collection

  const currentUser = await User.findById(req.user.id).select('+password');

  // 2-check if posted password is correct
  console.log(req.user);
  console.log(req.body.currentPassword, currentUser.password);
  if (
    !req.body.currentPassword ||
    !(await currentUser.correctPassword(
      req.body.currentPassword,
      currentUser.password,
    ))
  )
    next(new AppError('invalid password ', 401));

  //  3- update password

  currentUser.password = req.body.newPassword;
  currentUser.confirmPassword = req.body.confirmPassword;

  await currentUser.save();

  // currentUser.findByIdAndUpdate(currentUser.id) --> validator on confirmPassword wont work ,
  //  and pre save middleware wont work

  // 4- send back token

  createSendToken(currentUser, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('JWT', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.JWT) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.JWT,
        process.env.JWT_SECRET,
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.passwordChangeAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};
