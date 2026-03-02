import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const isProd = process.env.NODE_ENV === "production";

// Cookie config corect pentru local + production
const cookieOptions = {
  httpOnly: true,
  secure: isProd,                       // true în production (HTTPS)
  sameSite: isProd ? "none" : "lax",    // CRUCIAL pentru cross-domain
  maxAge: 7 * 24 * 60 * 60 * 1000,      // 7 zile
  path: "/",
};

function sign(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: "Email already used" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, email, password: hash },
    });

    const token = sign(user);

    res
      .cookie("token", token, cookieOptions)
      .status(201)
      .json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Register failed" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = sign(user);

    res
      .cookie("token", token, cookieOptions)
      .json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

/* =========================
   ME (pentru refresh)
========================= */
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user });

  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

/* =========================
   LOGOUT
========================= */
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  res.json({ ok: true });
});

export default router;