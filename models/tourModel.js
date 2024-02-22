const mongoose = require('mongoose');
const slugify = require('slugify');
const User = require('./userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'a tour must have a name'],
      unique: true,
      trim: true,
      minLength: [10, 'a tour name must be at least 10 characters'],
      maxLength: [40, 'a tour name must be at most 40 characters'],
      // validate: [validator.isAlpha, 'name must be alphabetic'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'a tour must have a max group size'],
    },
    secretTour: { type: Boolean, default: false },
    duration: {
      type: Number,
      required: [true, 'a tour must have a duration'],
    },
    slug: String,
    difficulty: {
      type: String,
      required: [true, 'a tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: ' tour difficulty must be easy or medium or difficult',
      },
    },

    ratingsAverage: {
      type: Number,
      default: 0,
      min: [1.0, ' a tour rating must be 1 or greater'],
      max: [5.0, 'a tour rating muse be 5 or less'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingQuantity: { type: Number, default: 0 },
    summary: {
      type: String,
      required: [true, 'a tour must have a summary'],
      trim: true,
    },
    description: { type: String, trim: true },
    price: {
      type: Number,
      required: [true, 'a tour must have  price'],
    },
    discountPrice: {
      type: Number,
      validate: {
        validator: function (val) {
          // this points to the document when creating only (updating wont work)
          return val < this.price;
        },
        message: 'discount price ({VALUE}) muse be less than price',
      },
    },
    imageCover: {
      type: String,
      required: [true, 'a tour must have a image cover'],
    },
    images: [String],
    startDates: [Date],
    createdAt: {
      type: Date,
      // TODO:  Date.now() will run on the first start => so later when new tour created date wont be updated
      default: Date.now(),
      select: false,
    },
    startLocation: {
      type: { type: String, default: 'Point', enum: ['Point'] },
      coordinates: [Number],
      address: String,
      description: String,
      day: Number,
    },

    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

tourSchema.index({ startLocation: '2dsphere' });

// virtual properties
tourSchema.virtual('durationWeeks').get(function () {
  // arrow function cant be used because of THIS key word
  return this.duration / 7;
});

tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// Document middleware  :run before .save() and  .create()
//  // this point to document in pre only
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lowercase: true });
  next();
});

tourSchema.index({ price: 1, ratingsAverage: -1 });
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log('post');
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE : run before any find()
//  // this point to query in both pre and post

// tourSchema.pre('find', function (next) {
tourSchema.pre(/^find/, function (next) {
  this.start = Date.now();
  this.find({ secretTour: { $ne: true } });
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   next();
// });
tourSchema.post(/^find/, function (docs, next) {
  console.log(`time taken by query in ms = ${Date.now() - this.start}`);
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt -passwordResetExpires -passwordResetToken',
  });
  next();
});

//Aggregation  middleware
// // this point to aggregation object in pre only

tourSchema.pre('aggregate', function (next) {
  if (!Object.keys(this.pipeline()[0])[0] === '$geoNear')
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  next();
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
