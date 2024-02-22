const multer = require('multer');
const sharp = require('sharp');

const User = require('../models/userModel');
const asyncCatch = require('../utils/asyncCatch');
const AppError = require('../utils/appError');
const factory = require('./factoryController');

const filterObj = (obj, ...allowedFields) => {
  const filtered = {};
  allowedFields.forEach((field) => {
    if (obj[field]) filtered[field] = obj[field];
  });
  return filtered;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);

// don't use for password
exports.updateUser = factory.updateOne(User);

exports.deleteUser = factory.deleteOne(User);

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else cb(new AppError('please provide an image file', 400), false);
};

const upload = multer({ fileFilter: multerFilter, storage: multerStorage });

exports.uploadPhoto = upload.single('photo');

exports.resizeUserPhoto = asyncCatch(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});
exports.updateMe = asyncCatch(async (req, res, next) => {
  // 1) check if password or confirm password exist
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError("can't moddify password , use /updatePassword", 400),
    );
  }

  // 2) filter fields
  const filteredObject = filterObj(req.body, 'name', 'email');
  if (req.file) filteredObject.photo = req.file.filename;

  // 3) update user
  const user = await User.findByIdAndUpdate(req.user.id, filteredObject, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    body: {
      user,
    },
  });
});

exports.deleteMe = asyncCatch(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  // 500 = internal server error
  res.status(500).json({
    status: 'error',
    message: 'this route does not exist , use sign up instead',
  });
};
