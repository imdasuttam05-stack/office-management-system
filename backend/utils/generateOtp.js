import crypto from "crypto";

export const generateOtp = () => {
  return String(
    crypto.randomInt(100000, 1000000)
  );
};
