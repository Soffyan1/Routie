import nodemailer from "nodemailer";

const passwords = "avxlzzzaplwllbyt";
const candidates = [
  "ibnusoffyantsauri3834@gmail.com",
  "ibnusoffyantsauri@gmail.com",
  "ibnusoffyan@gmail.com",
  "ibnusoffyan.tsauri@gmail.com"
];

async function check() {
  for (const email of candidates) {
    console.log(`Checking auth for: ${email}...`);
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: email,
          pass: passwords
        }
      });
      await transporter.verify();
      console.log(`🎉 SUCCESS! Verified email is: ${email}`);
      return email;
    } catch (err: any) {
      console.log(`❌ Failed for ${email}: ${err.message}`);
    }
  }
}

check().catch(console.error);
