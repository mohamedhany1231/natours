const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', (err) => {
  console.log('uncaught exception ! 🔥 , SHUTTING DOWN ');
  console.log(err.name, err.message);
  // since it handle sync code we don't need to wait  the server
  // crashing the app is a must here unlike unhandled rejection
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const port = process.env.PORT || 3000;
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DB, {
    // .connect(process.env.DATABASE_LOCAL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then((con) => {
    // console.log(con.connections);
    console.log('✅ connected to database');
  });

const server = app.listen(port, () => {
  console.log(`start listening on port ${port} ...`);
});

process.on('unhandledRejection', (err) => {
  console.log('unhandled rejection 🔥 , SHUTTING DOWN ');
  console.log(err.name, err.message);
  // using server close => to allow server time to handle pending requests before shutting down
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('sigterm received , shutting down');
  server.close(() => {
    console.log('process terminated');
  });
});
