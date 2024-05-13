import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import compression from 'compression';
import userRoutes from './routes/user';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import './passportConfig';
mongoose.set('strictQuery', false);

const mongoDB = `mongodb+srv://${process.env.MONGO_ID}:${process.env.MONGO_PW}@cluster0.6ohsxyd.mongodb.net/liftright?retryWrites=true&w=majority&appName=Cluster0`;

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(mongoDB);
  console.log('Connected');
}

const app = express();
const port = process.env.PORT || 3001;

if (typeof process.env.SESSION_KEY === 'undefined') {
  throw new Error('SESSION_KEY is not defined in the environment variables');
}

// Middleware setup
app.use(helmet()); // Helps secure your app by setting various HTTP headers
app.use(morgan('dev')); // Logs HTTP requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Parses URL-encoded bodies
app.use(compression());

if (app.get('env') === 'production') {
  app.use(
    cors({
      origin: 'https://www.liftrightai.com',
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    })
  );
  app.set('trust proxy', true);
  app.use(
    session({
      secret: process.env.SESSION_KEY,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: mongoDB,
      }),
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: app.get('env') === 'production',
        httpOnly: true,
        domain: '.liftrightai.com',
      },
    })
  );
} else {
  app.use(
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(
    session({
      secret: process.env.SESSION_KEY,
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    })
  );
}
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req: Request, res: Response) => {
  res.send('My API!');
});

app.use(userRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
