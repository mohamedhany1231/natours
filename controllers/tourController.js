const multer = require('multer');
const sharp = require('sharp');

const Tour = require('../models/tourModel');
const asyncCatch = require('../utils/asyncCatch');
const AppError = require('../utils/appError');
const factory = require('./factoryController');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage,price';
  req.query.fields = 'name,summary,ratingAverage,price,difficulty';
  next();
};

// app.get('/api/v1/tours/:id/:x?/:y?', (req, res) => {
//optional parameters will be undefined if not provided

exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.deleteTour = factory.deleteOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.createTour = factory.createOne(Tour);
exports.getAllTours = factory.getAll(Tour);

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else cb(new AppError('please provide an image file', 400), false);
};

const upload = multer({ fileFilter: multerFilter, storage: multerStorage });

exports.uploadPhotos = upload.fields([
  {
    name: 'imageCover',
    maxCount: 1,
  },
  {
    name: 'images',
    maxCount: 3,
  },
]);

// upload.single
// upload.array

exports.resizePhotos = asyncCatch(async (req, res, next) => {
  // console.log(req.files);
  if (req.files.imageCover) {
    // cover
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

    await sharp(req.files.imageCover[0].buffer)
      .resize(2000, 1333)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${req.body.imageCover}`);
  }
  if (req.files.images) {
    // images
    req.body.images = [];

    await Promise.all(
      req.files.images.map(async (file, i) => {
        const fileName = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
        await sharp(file.buffer)
          .resize(2000, 1333)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`public/img/tours/${fileName}`);

        req.body.images.push(fileName);
      }),
    );
  }

  next();
});

exports.getTourStats = asyncCatch(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        toursCount: { $sum: 1 },
        avgRating: { $avg: '$ratingAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: {
    //     _id: { $ne: 'EASY' },
    //   },
    // },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = asyncCatch(async (req, res, next) => {
  const year = +req.params.year;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTours: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: {
        month: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: {
        numTours: -1,
      },
    },
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// /tours-within/:distance/center:latlng/unit/:unit
exports.getToursWithin = asyncCatch(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  if (!lat || !lng)
    return next(
      new AppError(
        'latitude or longitude missing , please provide both in that form (lat,lng)',
        400,
      ),
    );

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.14;
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    result: tours.length,
    data: {
      tours,
    },
  });
});

exports.getDistances = asyncCatch(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  if (!lat || !lng)
    return next(
      new AppError(
        'latitude or longitude missing , please provide both in that form (lat,lng)',
        400,
      ),
    );

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: { type: 'point', coordinates: [+lng, +lat] },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    stats: 'success',
    data: {
      tours: distances,
    },
  });
});
