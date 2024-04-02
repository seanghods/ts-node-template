import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import UserModel from "./models/users";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const emailLower = email.toLowerCase();
        const user = await UserModel.findOne({ email: emailLower });

        if (!user) {
          return done(null, false, { message: "Incorrect email." });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// const googleCbUrl =
//   process.env.NODE_ENV == "production"
//     ? "https://api.liftrightai.com/auth/google/callback"
//     : "http://localhost:3001/auth/google/callback";

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID as string,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
//       callbackURL: googleCbUrl,
//       passReqToCallback: true,
//     },
//     async function (request, accessToken, refreshToken, profile, done) {
//       const email = profile.emails ? profile.emails[0].value : null;
//       try {
//         let user = await UserModel.findOne({ googleId: profile.id });
//         if (!user) {
//           user = new UserModel({
//             email: email,
//             googleId: profile.id,
//             verified: true,
//             credits: 0,
//           });
//           await user.save();
//           return done(null, user);
//         } else {
//           return done(null, user);
//         }
//       } catch (err: any) {
//         console.error(err);
//         return done(err);
//       }
//     }
//   )
// );
