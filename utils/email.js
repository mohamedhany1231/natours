const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `mohamed hany <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      return nodemailer.createTransport({
        service: 'SendinBlue',
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async send(template, subject) {
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    const mailOptions = {
      from: `mohamed hany <${process.env.EMAIL_FROM}>`,
      to: this.to,
      subject,
      html,
      text: htmlToText.htmlToText(html),
    };

    console.log('sending mail');
    await this.newTransport().sendMail(mailOptions);

    console.log('email sent');
    console.log('email sent');
    console.log('email sent');
    console.log('email sent');
  }

  async sendWelcome() {
    await this.send('welcome', 'welcome to natours family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'password reset token <valid for 10 minutes>',
    );
  }
};
// 1 - create transport

//   2- define mail options

//   3- send email
