import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import passport from "passport";
import UserModel from "../models/users";
import { IUser } from "../models/users";
import dotenv from "dotenv";
import { ServerClient } from "postmark";

dotenv.config();

if (typeof process.env.POSTMARK_SERVER_TOKEN === "undefined") {
  throw new Error("POSTMARK KEY is not defined in the environment variables");
}

const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);

const router = express.Router();

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

router.get("/api/check-session", async (req, res, next) => {
  if (req.isAuthenticated()) {
    const userObj = await UserModel.findOne({ _id: req.user._id })
      .populate("responses")
      .exec();
    if (!userObj) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      isAuthenticated: true,
      user: {
        email: userObj.email,
        verified: userObj.verified,
      },
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

router.post("/api/register", async (req, res) => {
  const { email, password, credits } = req.body;
  try {
    const emailLower = email.toLowerCase();
    const emailExists = await UserModel.findOne({ email: emailLower });
    if (emailExists) {
      res.json({ success: false, message: `Email already registered` });
      return;
    }
    const hashPass = await bcrypt.hash(req.body.password, 10);
    const verificationToken = crypto.randomBytes(20).toString("hex");

    const userDetail = {
      email: emailLower,
      password: hashPass,
      credits: 0,
      responses: [],
      verified: false,
      emailVerificationToken: verificationToken,
    };
    const user = new UserModel(userDetail);
    const result = await user.save();
    req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error(loginErr);
        return res.status(500).json({
          success: false,
          message: "Auto login error after registration",
        });
      }
      sendVerificationEmail(result.email, verificationToken);
      return res.json({
        success: true,
        message: "Registration and login successful",
        user: {
          email: result.email,
          verified: result.verified,
        },
      });
    });
  } catch (err) {
    console.log(err);
    return;
  }
});

async function sendVerificationEmail(email: string, verificationToken: string) {
  const verificationUrl = `https://www.liftrightai.com/verify-email?token=${verificationToken}`;

  const response = await client.sendEmailWithTemplate({
    From: "info@liftrightai.com",
    To: email,
    TemplateId: 35382048,
    TemplateModel: {
      name: "User",
      action_url: verificationUrl,
    },
  });
}

router.get("/api/verify-email", async (req, res) => {
  try {
    const token = req.query.token;
    const userFromToken = await UserModel.findOne({
      emailVerificationToken: token,
    });
    if (!userFromToken) {
      return res.status(400).json({ message: "Invalid token." });
    }

    userFromToken.verified = true;
    userFromToken.emailVerificationToken = undefined;
    const savedObj = await userFromToken.save();
    res.json({
      message: "Email successfully verified.",
      user: {
        email: savedObj.email,
        verified: savedObj.verified,
      },
    });
  } catch (err) {
    console.log(err);
  }
});

router.post("/api/contact-us", async (req, res) => {
  const { email, message } = req.body;
  client.sendEmail(
    {
      From: "info@liftrightai.com",
      To: "info@liftrightai.com",
      Subject: "Contact Us Email",
      TextBody: message,
      ReplyTo: email,
    },
    (error, result) => {
      if (error) {
        console.error("Error sending email via Postmark", error);
        res.status(500).json({ error: "Error sending email" });
      } else {
        console.log("Email sent successfully", result);
        res.json({ success: true, message: "Email sent successfully" });
      }
    }
  );
});

router.post("/api/log-in", (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!user) {
      return res.status(401).json({ error: info.message });
    }

    req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error(loginErr);
        return res.status(500).json({ error: "Login error" });
      }

      if (!req.user || !req.user._id) {
        return res
          .status(500)
          .json({ error: "User not properly authenticated" });
      }
      const userObj = await UserModel.findOne({ _id: req.user._id })
        .populate("responses")
        .exec();

      if (!userObj) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({
        success: true,
        user: {
          email: userObj.email,
          verified: userObj.verified,
        },
      });
    });
  })(req, res, next);
});

router.get("/api/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }

      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });

      res.json({ success: true, message: "Log out successful" });
    });
  });
});

router.post("/api/forgot-password", async (req, res) => {
  async function sendPasswordResetEmail(user: IUser, token: string) {
    try {
      const resetLink = `http://liftrightai.com/reset-password?token=${token}`;
      const response = await client.sendEmailWithTemplate({
        From: "info@liftrightai.com",
        To: user.email,
        TemplateId: 35399399,
        TemplateModel: {
          action_url: resetLink,
        },
      });
      console.log("Email sent successfully");
    } catch (err) {
      console.error("Error sending email", err);
    }
  }

  const email = req.body.email;

  const resetToken = crypto.randomBytes(20).toString("hex");
  const user = await UserModel.findOne({ email: email });
  let futureDate = new Date();
  futureDate.setTime(futureDate.getTime() + 3600000);
  if (user) {
    user.resetToken = resetToken;
    user.resetTokenExpires = futureDate;
    await user.save();

    sendPasswordResetEmail(user, resetToken);
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

router.post("/api/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await UserModel.findOne({ resetToken: token });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token." });
    }

    if (
      !user.resetTokenExpires ||
      user.resetTokenExpires.getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ message: "Password reset token has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: "Password successfully reset." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// router.get(
//   "/auth/google",
//   passport.authenticate("google", { scope: ["email"] })
// );

// const frontEndSuccess =
//   process.env.NODE_ENV === "production"
//     ? "https://www.liftrightai.com/profile"
//     : "http://localhost:5173/profile";

// const frontEndFail =
//   process.env.NODE_ENV === "production"
//     ? "https://www.liftrightai.com/"
//     : "http://localhost:5173";

// router.get(
//   "/auth/google/callback",
//   passport.authenticate("google", {
//     successRedirect: frontEndSuccess,
//     failureRedirect: frontEndFail,
//   })
// );

export default router;
