const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const viewRouter = require('./routes/viewRoutes');
const tourRouter = require('./routes/tourRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) MIDDLEWARE

//security http headers
app.use(helmet({ contentSecurityPolicy: false }));

// limit requests from same api
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'too mange requests from this IP , please try again in an hour.',
});

app.use('/api', limiter);

// use middleware , to allow access to req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// data sanitize against no sql query  injection
app.use(mongoSanitize());

// data sanitize against xss

app.use(xss());

//  prevent parameters

app.use(
  hpp({
    whitelist: [
      'difficulty',
      'ratingsAverage',
      'ratingQuantity',
      'duration',
      'maxGroupSize',
      'price',
    ],
  }),
);

app.use(compression());

// to server static file => if url doesn't match defined route , express will search the defined public folder for path that match the route
app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  req.requestedTime = new Date().toISOString();

  next();
});

// 3) ROUTERS

// mounting the router on the routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// error handling

app.all('*', (req, res, next) => {
  const err = new AppError(`cant find ${req.originalUrl} on the server`, 404);

  next(err);
});

app.use(globalErrorHandler);

module.exports = app;
