const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const asyncCatch = require('../utils/asyncCatch');
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const factorController = require('./factoryController');

exports.getCheckoutSession = asyncCatch(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId);

  //   create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/?tour=${tour.id}&user=${
      req.user.id
    }&price=${tour.price}`,
    cancel_url: `${req.protocol}://${req.get('host')}/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourId,
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100,
          product_data: {
            name: `${tour.name}  tour`,
            description: tour.summary,
          },
        },
      },
    ],
  });

  res.status(200).json({
    status: 'success',
    session,
  });
});

exports.createCheckout = asyncCatch(async (req, res, next) => {
  const { tour, user, price } = req.query;
  if (!tour || !user || !price) return next();

  await Booking.create({ tour, user, price });
  res.redirect(req.originalUrl.split('?')[0]);
});

exports.getBooking = factorController.getOne(Booking);
exports.getAllBookings = factorController.getAll(Booking);
exports.deleteBooking = factorController.deleteOne(Booking);
exports.updateBooking = factorController.updateOne(Booking);
exports.createBooking = factorController.createOne(Booking);
