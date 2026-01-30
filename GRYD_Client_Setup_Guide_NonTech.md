# GRYD Platform
## Step-by-Step Setup Guide for Non-Technical Users

---

**Welcome!** This guide will walk you through creating all the accounts needed for your GRYD platform. Each step includes detailed instructions with exactly what to click and where to go.

**Time Required:** About 1-2 hours to complete all steps

**What You'll Create:**
1. MongoDB Atlas account (your database)
2. Cloudinary account (for storing images and files)
3. Agora account (for voice and video calls)
4. Brevo account (for sending emails)

---

## Before You Start

**You will need:**
- A valid email address
- A phone number (for some verifications)
- A credit card (some services require it, but won't charge for free tiers)
- A notepad or document to save your credentials

**Important:** Create a document (Word, Google Doc, or Notepad) to save all your credentials as you go. You'll need to share these with your developer.

---

## STEP 1: Create MongoDB Atlas Account (Database)

**What is this?** MongoDB stores all your data - users, messages, communities, everything.

**Cost:** Free to start (M0 tier), upgrades available later

---

### Step 1.1: Go to MongoDB Website

1. Open your web browser (Chrome, Firefox, Safari, etc.)
2. Go to: **https://www.mongodb.com/atlas**
3. You'll see a page with "The Multi-Cloud Developer Data Platform"

---

### Step 1.2: Create Your Account

1. Click the green button that says **"Try Free"** (top right corner)

2. You'll see a signup form. You have 3 options:
   - **Option A:** Click "Sign up with Google" (easiest if you have Gmail)
   - **Option B:** Click "Sign up with GitHub" (if you have GitHub)
   - **Option C:** Fill in the form manually:
     - First Name: [Your first name]
     - Last Name: [Your last name]
     - Email: [Your email address]
     - Password: [Create a strong password]

3. Check the box "I agree to the Terms of Service and Privacy Policy"

4. Click **"Create Your Account"**

5. **Check your email** for a verification link and click it

---

### Step 1.3: Answer the Welcome Questions

After verifying your email, MongoDB will ask some questions:

1. **"What is your goal today?"**
   - Select: "Build a new application"
   - Click **"Next"**

2. **"What type of application are you building?"**
   - Select: "Web application"
   - Click **"Next"**

3. **"What is your preferred language?"**
   - Select: "JavaScript"
   - Click **"Finish"**

---

### Step 1.4: Create Your Free Database

1. You'll see a page saying "Deploy your database"

2. Look for **three options** (boxes):
   - M0 FREE (green "FREE" badge) ← **SELECT THIS ONE**
   - M2
   - M5

3. Click on **"M0 FREE"** to select it

4. **Choose your cloud provider:**
   - You'll see AWS, Google Cloud, Azure
   - **Select: AWS** (it's the default and works great)

5. **Choose your region:**
   - Look for a location close to your users
   - For US: Select "N. Virginia (us-east-1)"
   - For Europe: Select "Ireland (eu-west-1)"
   - For Asia: Select "Singapore (ap-southeast-1)"

6. **Cluster Name:**
   - You can leave it as "Cluster0" or change it to "GRYD-Production"

7. Click the green **"Create Deployment"** button

8. **Wait 1-3 minutes** while your database is created (you'll see a loading screen)

---

### Step 1.5: Create Database User (VERY IMPORTANT)

A popup will appear asking you to create a database user.

1. **Username:**
   - Type: `gryd_admin`
   - (Or choose your own username - remember it!)

2. **Password:**
   - Click **"Autogenerate Secure Password"**
   - A password will appear like: `Abc123XyzDef456`

3. **⚠️ CRITICAL: COPY THIS PASSWORD NOW!**
   - Click the **"Copy"** button next to the password
   - Paste it in your notepad/document
   - Label it: "MongoDB Password"
   - **You cannot see this password again after leaving this page!**

4. Write down in your document:
   ```
   MongoDB Database User:
   - Username: gryd_admin
   - Password: [paste the password here]
   ```

5. Click **"Create Database User"**

---

### Step 1.6: Set Up Network Access

Still on the same page, you'll see a section about "Where would you like to connect from?"

1. Select **"My Local Environment"** (even though it's not local, this is fine)

2. Click **"Add My Current IP Address"**
   - This adds your computer's IP

3. **IMPORTANT:** We need to allow access from anywhere (for your server)
   - Click **"Add IP Address"** button
   - In the popup, type: `0.0.0.0/0`
   - Description: "Allow all (Production server)"
   - Click **"Add IP Address"**

4. Click **"Finish and Close"**

5. A popup might say "Congratulations!" - click **"Go to Database"**

---

### Step 1.7: Get Your Connection String

This is the most important part - you need this to connect your app to the database.

1. You should now see your "Database Deployments" page with "Cluster0" (or your cluster name)

2. Find your cluster and click the **"Connect"** button

3. A popup appears with connection options. Click **"Drivers"** (or "Connect your application")

4. You'll see:
   - Driver: Node.js (leave it)
   - Version: Select the latest (5.5 or higher)

5. **Look for the connection string** - it looks like this:
   ```
   mongodb+srv://gryd_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. Click the **"Copy"** button next to it

7. **Now you need to modify it:**
   - Paste it in your notepad
   - Find `<password>` in the string
   - Replace `<password>` with your actual password (from Step 1.5)
   - Add `/gryd` before the `?` to specify your database name

8. **Your final connection string should look like:**
   ```
   mongodb+srv://gryd_admin:Abc123XyzDef456@cluster0.ab1cd.mongodb.net/gryd?retryWrites=true&w=majority
   ```

9. **Save this in your document as:**
   ```
   MongoDB Connection String (MONGO_URI):
   mongodb+srv://gryd_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/gryd?retryWrites=true&w=majority
   ```

---

### ✅ MongoDB Setup Complete!

**What you should have saved:**
```
=== MONGODB ATLAS ===
Username: gryd_admin
Password: [your password]
Connection String (MONGO_URI): mongodb+srv://gryd_admin:password@cluster0.xxxxx.mongodb.net/gryd?retryWrites=true&w=majority
```

---

## STEP 2: Create Cloudinary Account (Image & File Storage)

**What is this?** Cloudinary stores all images, profile pictures, and files uploaded to your platform.

**Cost:** Free (25GB storage, 25GB bandwidth per month)

---

### Step 2.1: Go to Cloudinary Website

1. Open a new browser tab
2. Go to: **https://cloudinary.com**
3. You'll see "Image and Video API Platform"

---

### Step 2.2: Create Your Account

1. Click **"Sign Up For Free"** (top right corner, blue button)

2. Fill in the form:
   - **Email:** [Your email address]
   - **Full Name:** [Your full name]
   - **Password:** [Create a password]
   - **Cloud Name:** This will be auto-generated, like "dxyz123abc"
     - You can change it to something like "gryd-media" if available
     - **Write down whatever it is!**

3. Check the boxes:
   - "I have read and agree to the Terms of Service"
   - "I have read and understood the Privacy Policy"

4. Click **"Create Account"**

5. **Check your email** for a verification link and click it

---

### Step 2.3: Get Your Cloudinary Credentials

After verifying, you'll be taken to your Dashboard.

1. Look at the **Dashboard** page - you should see a section called "Account Details" or "API Environment Variable"

2. You'll see three important values:
   - **Cloud Name:** Something like `dxyz123abc`
   - **API Key:** A number like `123456789012345`
   - **API Secret:** A long string like `AbCdEfGhIjKlMnOpQrStUvWx`

3. **Copy each one** and save in your document:
   ```
   === CLOUDINARY ===
   Cloud Name: dxyz123abc
   API Key: 123456789012345
   API Secret: AbCdEfGhIjKlMnOpQrStUvWx
   ```

**⚠️ Keep the API Secret private - don't share it publicly!**

---

### ✅ Cloudinary Setup Complete!

**What you should have saved:**
```
=== CLOUDINARY ===
Cloud Name (CLOUDINARY_CLOUD_NAME): dxyz123abc
API Key (CLOUDINARY_API_KEY): 123456789012345
API Secret (CLOUDINARY_API_SECRET): AbCdEfGhIjKlMnOpQrStUvWx
```

---

## STEP 3: Create Agora Account (Voice & Video Calls)

**What is this?** Agora powers all the voice and video calling features in your platform.

**Cost:** Free (10,000 minutes per month for audio AND video)

---

### Step 3.1: Go to Agora Website

1. Open a new browser tab
2. Go to: **https://www.agora.io**
3. You'll see "Real-Time Engagement Platform"

---

### Step 3.2: Create Your Account

1. Click **"Sign Up"** or **"Start Building"** (top right)

2. You'll see a signup form:
   - **Email:** [Your email address]
   - **Password:** [Create a password - must have uppercase, lowercase, number]
   - **Company/Organization:** [Your company name or "GRYD Platform"]
   - **Country:** [Select your country]

3. Check the box agreeing to terms

4. Click **"Sign Up"**

5. **Check your email** for a verification code
   - Enter the 6-digit code on the website
   - Click **"Verify"**

---

### Step 3.3: Answer Onboarding Questions

Agora might ask some questions:

1. **"What best describes your role?"**
   - Select: "Business/Product"
   - Click **"Next"**

2. **"What are you building?"**
   - Select: "Social/Community"
   - Click **"Next"**

3. Skip any other questions if possible (look for "Skip" button)

---

### Step 3.4: Create Your First Project

1. You should be in the Agora Console now
2. Look for **"Project Management"** in the left sidebar and click it
3. Click the blue button **"Create New Project"** (or "Create")

4. Fill in the form:
   - **Project Name:** `GRYD`
   - **Use Case:** Select "Social/Community" or "Other"
   - **Authentication Mode:** Select **"Secured mode: APP ID + Token"** ⚠️ Important!

5. Click **"Submit"** or **"Create"**

---

### Step 3.5: Get Your Agora Credentials

1. You'll see your new project "GRYD" in the list

2. Click on the project name to open it

3. You'll see:
   - **App ID:** A long string like `b8e8845f756941919a6b50dd82a5a35f`
   - Copy this and save it

4. **Get the App Certificate:**
   - Look for "App Certificate" section
   - If it shows "Disabled" or "Not Enabled":
     - Click **"Enable"** or the toggle switch
     - Confirm if asked
   - Once enabled, you'll see the certificate
   - Click **"Copy"** or the copy icon
   - It looks like: `18360d9efb734119ab7d741e2b456234`

5. **Save both in your document:**
   ```
   === AGORA ===
   App ID: b8e8845f756941919a6b50dd82a5a35f
   App Certificate: 18360d9efb734119ab7d741e2b456234
   ```

---

### ✅ Agora Setup Complete!

**What you should have saved:**
```
=== AGORA ===
App ID (AGORA_APP_ID): b8e8845f756941919a6b50dd82a5a35f
App Certificate (AGORA_APP_CERTIFICATE): 18360d9efb734119ab7d741e2b456234
```

---

## STEP 4: Create Brevo Account (Email Service)

**What is this?** Brevo sends all the emails from your platform - invitations, verification codes, notifications.

**Cost:** Free (300 emails per day)

---

### Step 4.1: Go to Brevo Website

1. Open a new browser tab
2. Go to: **https://www.brevo.com**
3. You'll see "The most approachable CRM suite"

---

### Step 4.2: Create Your Account

1. Click **"Sign Up Free"** (top right corner)

2. Fill in the form:
   - **Email:** [Your email address]
   - **Password:** [Create a password]
   - **Company Name:** [Your company name]
   - **Website:** [Your website if you have one, or skip]

3. Check the boxes for terms and privacy policy

4. Click **"Create an account"**

5. **Check your email** for a confirmation link and click it

---

### Step 4.3: Complete Your Profile

Brevo will ask some questions to set up your account:

1. **"What's your first name and last name?"**
   - Fill in your name
   - Click **"Next"**

2. **"What's your company details?"**
   - Company name: [Your company]
   - Company size: Select appropriate option
   - Click **"Next"**

3. **"What's your address?"**
   - Fill in your business address (required for email compliance)
   - Click **"Next"**

4. **"What will you use Brevo for?"**
   - Select: "Transactional emails"
   - Click **"Finish"**

---

### Step 4.4: Get Your API Key

1. After setup, you'll be on the Brevo dashboard

2. Look at the **top right corner** for your account icon/name

3. Click on it and select **"SMTP & API"** from the dropdown
   - OR go to: Settings (gear icon) → SMTP & API

4. You'll see the "API Keys" section

5. Click **"Generate a new API key"**

6. **Name your key:**
   - Enter: `GRYD Production`
   - Click **"Generate"**

7. **Your API key will appear** - it looks like:
   ```
   xkeysib-1ecc41a57bde20d00d62914e13a5029a8991d888c821c48f746e2fdd00fba838-AbCdEfGhIjKl
   ```

8. **⚠️ IMPORTANT: Copy it NOW!**
   - Click the **"Copy"** button
   - Paste it in your document
   - **You can only see this once!**

---

### Step 4.5: Verify Your Sender Email

This is important - emails won't send without a verified sender.

1. In Brevo, go to **"Senders & IP"** (in the left menu or settings)

2. Click **"Senders"** tab

3. Click **"Add a sender"**

4. Fill in:
   - **From email:** `noreply@yourcompany.com` (use your real domain email)
   - **From name:** `GRYD Platform` (or your preferred name)

5. Click **"Save"**

6. **Check your email** for a verification link and click it

7. Your sender is now verified! ✅

**Note:** If you don't have a company email, you can use your personal email for testing, but for production you should use a professional email address.

---

### ✅ Brevo Setup Complete!

**What you should have saved:**
```
=== BREVO (EMAIL) ===
API Key (BREVO_API_KEY): xkeysib-your-api-key-here
From Email (EMAIL_FROM_ADDRESS): noreply@yourcompany.com
From Name (EMAIL_FROM_NAME): GRYD Platform
```

---

## STEP 5: Generate Your JWT Secret

**What is this?** A secret code that keeps user logins secure. Think of it as a master password for your system.

---

### Option A: Use an Online Generator (Easiest)

1. Go to: **https://randomkeygen.com**

2. Scroll down to find **"CodeIgniter Encryption Keys"**

3. You'll see random strings like:
   ```
   7f3d8a2b1c4e5f6a7b8c9d0e1f2a3b4c
   ```

4. **Copy any one of them** (click to copy)

5. **Make it longer** - copy TWO of them and combine:
   ```
   7f3d8a2b1c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
   ```

6. Save in your document:
   ```
   === JWT SECRET ===
   JWT_SECRET: 7f3d8a2b1c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
   ```

---

### Option B: Use a Password Generator

1. Go to: **https://passwordsgenerator.net**

2. Settings:
   - Length: 64
   - Include: Uppercase, Lowercase, Numbers
   - Exclude: Symbols (uncheck)

3. Click **"Generate Password"**

4. Copy the result and save it

---

### ✅ JWT Secret Complete!

**What you should have saved:**
```
=== JWT SECRET ===
JWT_SECRET: [your 64+ character random string]
```

---

## STEP 6: Choose Your Hosting (DigitalOcean or AWS)

You need to decide where to host your backend server.

### Quick Comparison

| Feature | DigitalOcean | AWS |
|---------|--------------|-----|
| **Ease of Use** | ⭐⭐⭐⭐⭐ Very Easy | ⭐⭐⭐ Complex |
| **Best For** | Beginners, Small-Medium | Large Enterprise |
| **Dashboard** | Simple, Clean | Complex, Many Options |
| **Pricing** | Simple: $12-48/mo | Complex: varies |
| **Setup Time** | 30 minutes | 1-2 hours |
| **Recommendation** | ✅ **Recommended** | For advanced users |

---

### Option A: DigitalOcean (Recommended)

**Why choose this:** Simpler to use, predictable pricing, great for most businesses.

#### Create DigitalOcean Account

1. Go to: **https://www.digitalocean.com**

2. Click **"Sign Up"** (top right)

3. Sign up options:
   - **Google account** (easiest)
   - **GitHub account**
   - **Email and password**

4. **Add Payment Method:**
   - You'll need to add a credit card
   - New accounts often get **$200 free credit** for 60 days!

5. **Verify your account** via email if required

6. Once logged in, you'll see the DigitalOcean dashboard

**👉 Share your DigitalOcean login with your developer, OR add them as a team member:**

To add team member:
1. Click your account icon (top right)
2. Go to "Team"
3. Click "Invite Members"
4. Enter developer's email
5. They'll get access to help you

---

### Option B: AWS (Advanced)

**Why choose this:** More features, better for very large scale, required for some compliance.

#### Create AWS Account

1. Go to: **https://aws.amazon.com**

2. Click **"Create an AWS Account"** (top right)

3. Fill in:
   - **Email address:** [Your email]
   - **Account name:** `GRYD Production`
   - Click **"Verify email address"**

4. **Check your email** and enter the verification code

5. **Create password** for your AWS account

6. **Contact Information:**
   - Account type: Business (or Personal)
   - Fill in your details
   - Click **"Continue"**

7. **Payment Information:**
   - Add credit card (required)
   - AWS may charge $1 temporarily to verify (refunded)

8. **Identity Verification:**
   - Enter phone number
   - Choose Text or Voice call
   - Enter verification code

9. **Select Support Plan:**
   - Choose **"Basic support - Free"**

10. **Complete signup** and wait for account activation (can take a few minutes to 24 hours)

**👉 To give your developer access:**

1. Go to AWS Console
2. Search for "IAM" (Identity and Access Management)
3. Click "Users" → "Add Users"
4. Create a user for your developer
5. Share the login credentials with them

---

## FINAL STEP: Compile All Your Credentials

Now let's put everything together in a format your developer needs.

### Your Complete Environment Variables

Copy this template and fill in YOUR values:

```
============================================
GRYD PLATFORM - YOUR CREDENTIALS
============================================

# Database (MongoDB Atlas)
MONGO_URI=mongodb+srv://gryd_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/gryd?retryWrites=true&w=majority

# Security
JWT_SECRET=your_64_character_secret_here

# Email Service (Brevo)
BREVO_API_KEY=xkeysib-your-api-key-here
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=GRYD Platform

# File Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Voice/Video Calls (Agora)
AGORA_APP_ID=your-app-id
AGORA_APP_CERTIFICATE=your-app-certificate

# Hosting Choice
HOSTING_PLATFORM=DigitalOcean (or AWS)
HOSTING_LOGIN_EMAIL=your-email@example.com

============================================
```

---

## What Happens Next?

1. **Send your credentials document to your developer** (via secure method - not regular email!)
   - Use a secure sharing method like:
     - Password-protected document
     - Secure messaging app
     - Password manager sharing

2. **Share hosting access:**
   - Add developer as team member on DigitalOcean, OR
   - Create IAM user on AWS

3. **Developer will:**
   - Set up your server
   - Deploy the application
   - Configure everything
   - Give you your live URLs

4. **You'll receive:**
   - Frontend URL: `https://your-app.vercel.app`
   - Instructions to create your Super Admin account

---

## Summary Checklist

Before sending to developer, make sure you have:

```
✅ MongoDB Atlas
   □ Account created
   □ Database created
   □ Username saved
   □ Password saved
   □ Connection string saved

✅ Cloudinary
   □ Account created
   □ Cloud Name saved
   □ API Key saved
   □ API Secret saved

✅ Agora
   □ Account created
   □ Project created
   □ App ID saved
   □ App Certificate saved (and enabled!)

✅ Brevo
   □ Account created
   □ API Key saved
   □ Sender email verified

✅ JWT Secret
   □ 64+ character random string generated

✅ Hosting
   □ DigitalOcean OR AWS account created
   □ Payment method added
   □ Developer access granted
```

---

## Monthly Costs Summary

Based on your choice of plan:

| Plan | Members | Monthly Cost |
|------|---------|--------------|
| **Starter** | < 500 | $0-20 |
| **Growth** | 500-2,500 | ~$112 |
| **Professional** | 2,500-10,000 | ~$370 |
| **Enterprise** | 10,000+ | ~$960+ |

Your developer will help you choose the right plan based on your expected usage.

---

## Need Help?

If you get stuck on any step:

1. **Take a screenshot** of where you're stuck
2. **Note which step number** you're on
3. **Contact your developer** with these details

Most issues can be resolved quickly with the right information!

---

**Congratulations!** 🎉

You've completed all the account setups needed for your GRYD platform. Your developer now has everything they need to deploy your application.

---

*Document Version 1.0 | January 2026*
