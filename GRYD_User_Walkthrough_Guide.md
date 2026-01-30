# GRYD Platform
## Complete User Walkthrough Guide

---

**This guide will walk you through:**
1. Creating your Super Admin account
2. Setting up Credit Union customers (CU Admins)
3. CU Admin server setup and customization
4. Inviting Stakeholders (VIP users)
5. Inviting Members to join the community

---

## Understanding the User Hierarchy

Before we start, here's how the platform is organized:

```
┌─────────────────────────────────────────────────────────────┐
│                      YOU (SUPER ADMIN)                       │
│                    Platform Owner - Top Level                │
│                                                              │
│   You can:                                                   │
│   • Create Credit Union customers                            │
│   • Monitor all activity                                     │
│   • Manage platform settings                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ You invite CU Admins
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CU ADMINS (Your Customers)                │
│              Each manages their own Credit Union             │
│                                                              │
│   They can:                                                  │
│   • Customize their server (logo, name, colors)              │
│   • Invite Stakeholders (VIPs)                               │
│   • Invite Members                                           │
│   • Create channels                                          │
│   • Manage their community                                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│    STAKEHOLDERS     │       │      MEMBERS        │
│    (VIP Users)      │       │  (Regular Users)    │
│                     │       │                     │
│ Special badges:     │       │ Join via invite     │
│ • Vendor            │       │ code shared by      │
│ • Partner           │       │ CU Admin            │
│ • Sponsor           │       │                     │
│ • Investor          │       │                     │
└─────────────────────┘       └─────────────────────┘
```

---

# PART 1: Super Admin Setup

## Step 1.1: Create Your Super Admin Account

**This is your master account - you only need to do this once.**

### Go to the Signup Page

1. Open your web browser
2. Go to your platform URL:
   ```
   https://your-app.vercel.app/super-admin-signup
   ```
   (Replace "your-app.vercel.app" with your actual URL)

3. You'll see a signup form

### Fill in Your Details

1. **First Name:** Enter your first name

2. **Last Name:** Enter your last name

3. **Email:** Enter your email address
   - Use a professional email you check regularly
   - This will be your login email

4. **Password:** Create a strong password
   - At least 6 characters
   - Recommended: Mix of letters, numbers, symbols

5. **Secret Key:** Enter the super admin secret key
   ```
   GRYD_SUPER_ADMIN_2024
   ```
   ⚠️ This key ensures only authorized people can create super admin accounts

6. Click **"Create Account"** or **"Sign Up"**

### Verification (if required)

1. Check your email for a verification code
2. Enter the code on the website
3. Click **"Verify"**

### ✅ Success!

You should now see a success message and be redirected to the dashboard, or you can log in.

---

## Step 1.2: Log In to Super Admin Dashboard

1. Go to: `https://your-app.vercel.app/admin-login`

   OR go to the main login page: `https://your-app.vercel.app/login`

2. Enter your credentials:
   - **Email:** [The email you just signed up with]
   - **Password:** [Your password]

3. Click **"Login"**

4. You'll be taken to the **Super Admin Dashboard**

---

## Step 1.3: Understanding the Super Admin Dashboard

When you log in, you'll see your dashboard with several sections:

### Dashboard Overview

| Section | What It Shows |
|---------|---------------|
| **Overview/Stats** | Total customers, members, activity |
| **Customers** | List of Credit Unions you've created |
| **Team** | Other admins helping you manage the platform |
| **Settings** | Platform-wide settings |

### Navigation Menu

Look for these menu items (usually on the left side or top):

- **Dashboard** - Main overview
- **Customers** - Manage Credit Union customers
- **Team** - Manage your admin team
- **Moderation** - Review reported content
- **Settings** - Platform configuration

---

# PART 2: Creating Credit Union Customers (CU Admins)

This is how you onboard new Credit Unions to your platform.

## Step 2.1: Navigate to Customers

1. From your Super Admin Dashboard
2. Click on **"Customers"** in the menu
3. You'll see a list of existing customers (empty if first time)

## Step 2.2: Add New Customer

1. Look for a button that says:
   - **"Add Customer"**
   - **"+ New Customer"**
   - **"Create Customer"**
   - Or a **"+"** icon

2. Click this button

3. A form or popup will appear

## Step 2.3: Fill in Customer Details

Fill in the following information:

### Basic Information

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Customer/Company Name** | The Credit Union's name | "First National Credit Union" |
| **Admin Email** | Email of the person who will manage this CU | "admin@firstnationalcu.com" |
| **Admin First Name** | Their first name (optional) | "John" |
| **Admin Last Name** | Their last name (optional) | "Smith" |

### Additional Settings (if available)

| Field | What to Enter |
|-------|---------------|
| **Plan/Tier** | Select their subscription level |
| **Member Limit** | Maximum members allowed (if applicable) |
| **Status** | Active (default) |

## Step 2.4: Send Invitation

1. Review the information you entered

2. Click **"Create Customer"** or **"Send Invitation"**

3. **What happens now:**
   - The system creates a new "server" (community space) for this Credit Union
   - An invitation email is sent to the admin email address
   - The email contains a special setup link

## Step 2.5: What the CU Admin Receives

The Credit Union admin will receive an email like this:

```
Subject: You've been invited to set up your GRYD community

Hi John,

You've been invited to set up and manage the First National Credit Union
community on GRYD.

Click the link below to complete your setup:
[Setup Your Account]

This link will expire in 7 days.

If you didn't expect this email, please ignore it.

Best regards,
The GRYD Team
```

---

### ✅ Customer Created!

You should see the new customer in your Customers list with status "Pending Setup" until they complete their setup.

---

# PART 3: CU Admin Server Setup

**This section is for the Credit Union Admin** (the person you invited in Part 2)

## Step 3.1: Click the Setup Link

1. **Check email** for the invitation from GRYD

2. **Click the setup link** in the email
   - It looks like: `https://your-app.vercel.app/setup?token=xxx&tenant=xxx`

3. You'll be taken to the **Setup Wizard**

## Step 3.2: Verify Your Email (OTP)

1. The page will show: "We've sent a verification code to your email"

2. **Check your email** for a 6-digit code

3. **Enter the code** in the boxes provided

4. Click **"Verify"** or the code will auto-submit

## Step 3.3: Create Your Profile

After verification, you'll set up your personal admin profile:

### Personal Information

| Field | What to Enter |
|-------|---------------|
| **First Name** | Your first name |
| **Last Name** | Your last name |
| **Username** | A display name (optional) |
| **Profile Picture** | Upload a photo (optional) |

1. Fill in your details
2. Click **"Continue"** or **"Next"**

## Step 3.4: Customize Your Server

Now you'll customize how your Credit Union's community looks:

### Server Branding

| Field | What to Enter | Tips |
|-------|---------------|------|
| **Server Name** | Your community name | "First National CU Community" |
| **Description** | Brief description | "Connect with fellow members" |
| **Server Logo** | Upload your CU logo | Square image works best (512x512px) |
| **Banner Color** | Choose a theme color | Match your brand colors |

### Steps:

1. **Server Name:**
   - Enter a name for your community
   - This is what members will see

2. **Description:** (if available)
   - Write a short welcome description
   - Example: "Welcome to the First National Credit Union community! Connect with fellow members and stay updated."

3. **Upload Logo:**
   - Click **"Upload"** or the image placeholder
   - Select your Credit Union's logo
   - Supported formats: PNG, JPG
   - Recommended size: 512x512 pixels

4. **Choose Colors:** (if available)
   - Select a primary color that matches your brand
   - This will be used throughout your community

5. Click **"Continue"** or **"Save"**

## Step 3.5: Setup Complete!

You'll see a success screen with:

1. **Your server is ready!**

2. **Your Invite Code** - A code like `FNCU-2024` or `ABC123`
   - ⚠️ **Save this code!** You'll share it with members

3. Options to:
   - **Go to Dashboard** - Start managing your community
   - **Invite Members** - Start inviting people right away

Click **"Go to Dashboard"** to continue

---

# PART 4: CU Admin Dashboard Navigation

**Welcome to your Credit Union Admin Dashboard!**

## Step 4.1: Understanding Your Dashboard

When you log in, you'll see your CU Admin dashboard:

### Main Sections

| Section | Purpose |
|---------|---------|
| **Overview** | Stats about your community (members, messages, etc.) |
| **Members** | View and manage all members |
| **Stakeholders** | View and manage VIP users |
| **Channels** | Create and manage chat channels |
| **Settings** | Server settings, invites, customization |

### Quick Stats (Overview)

- **Total Members** - How many people have joined
- **Online Now** - Currently active members
- **Messages Today** - Activity level
- **New This Week** - Recent signups

## Step 4.2: Navigation Menu

Your menu typically includes:

```
📊 Dashboard (Overview)
👥 Members
⭐ Stakeholders
💬 Channels
📢 Announcements
⚙️ Settings
   ├── Server Settings
   ├── Invite Members
   ├── Invite Stakeholders
   └── Roles & Permissions
```

---

# PART 5: Inviting Stakeholders (VIP Users)

**Stakeholders are special VIP members** like vendors, partners, sponsors, or investors. They get a special badge next to their name.

## Step 5.1: Navigate to Stakeholder Invites

**Option A - From Settings:**
1. Click **"Settings"** in the menu
2. Click **"Invite Stakeholders"**

**Option B - From Stakeholders List:**
1. Click **"Stakeholders"** in the menu
2. Click **"Invite New"** or **"+ Add Stakeholder"**

## Step 5.2: Fill in Stakeholder Details

You'll see an invitation form:

### Required Information

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Email Address** | Stakeholder's email | "vendor@company.com" |
| **Badge Type** | Select their role | See options below |

### Badge Types Explained

| Badge | Who Gets This |
|-------|---------------|
| **Vendor** | Companies selling products/services to your members |
| **Partner** | Organizations you partner with |
| **Sponsor** | Companies sponsoring events or programs |
| **Investor** | Investment partners |

### Steps:

1. **Enter Email:**
   - Type the stakeholder's email address
   - Double-check for typos!

2. **Select Badge Type:**
   - Click the dropdown
   - Select: Vendor, Partner, Sponsor, or Investor
   - This badge will appear on their profile

3. **Add Message** (optional):
   - Some systems let you add a personal note
   - Example: "Welcome to our community! Looking forward to working with you."

4. Click **"Send Invitation"**

## Step 5.3: What the Stakeholder Receives

The stakeholder will receive an email like:

```
Subject: You've been invited to join First National CU as a Vendor

Hi,

You've been invited to join the First National Credit Union community
as a Vendor.

Click below to create your account:
[Accept Invitation]

Best regards,
First National Credit Union
```

## Step 5.4: Stakeholder Signup Process

When the stakeholder clicks the link, they will:

1. **Land on the signup page** with their badge pre-selected

2. **Verify their email** with OTP code

3. **Create their profile:**
   - First Name
   - Last Name
   - Username (optional)
   - Profile Picture (optional)

4. **Access the community** with their special badge displayed

---

### ✅ Stakeholder Invited!

You can track invitation status in your Stakeholders list:
- **Pending** - Invitation sent, not yet accepted
- **Active** - They've completed signup

---

# PART 6: Inviting Members

**Members are regular users** who join your Credit Union community.

## Method 1: Share Invite Code (Easiest)

### Step 6.1: Find Your Invite Code

1. Go to **Settings** → **Invite Members**

   OR look for **"Invite Code"** section on your dashboard

2. You'll see your unique invite code:
   ```
   Your Invite Code: FNCU-2024
   ```

3. You can also see a **QR code** (if available) that members can scan

### Step 6.2: Share the Code

Share this code with people who should join:

**Ways to share:**

| Method | How to Do It |
|--------|--------------|
| **Email** | Include code in a welcome email |
| **Website** | Post on your Credit Union website |
| **Social Media** | Share on Facebook, Twitter, etc. |
| **Print** | Include in newsletters or flyers |
| **In-Person** | Tell members at branches |

**Example message to share:**

```
Join our new online community!

1. Go to: https://your-app.vercel.app/member-signup
2. Enter invite code: FNCU-2024
3. Follow the steps to create your account

Connect with fellow members, get updates, and more!
```

### Step 6.3: Copy Invite Link

Some systems provide a direct link instead of/in addition to a code:

1. Look for **"Copy Invite Link"** button
2. Click to copy the full URL
3. Share this link directly - members won't need to enter a code

---

## Method 2: Direct Member Invitation (By Email)

If your system supports it, you can invite specific people by email:

### Step 6.4: Invite by Email

1. Go to **Settings** → **Invite Members**

2. Look for **"Invite by Email"** option

3. Enter member's email address

4. Click **"Send Invitation"**

5. They'll receive an email with a direct link to join

---

## How Members Sign Up

When someone wants to join your community, here's their experience:

### Member Signup Steps

**Step 1: Go to Signup Page**
- URL: `https://your-app.vercel.app/member-signup`
- Or click the invite link you shared

**Step 2: Enter Invite Code**
- They enter the code: `FNCU-2024`
- Click **"Continue"** or **"Verify Code"**

**Step 3: See Server Preview**
- They'll see your Credit Union's:
  - Logo
  - Server name
  - Description
  - Member count
- Click **"Join"** to continue

**Step 4: Enter Email**
- They enter their email address
- Click **"Send Code"**

**Step 5: Verify Email (OTP)**
- Check email for 6-digit code
- Enter the code
- Click **"Verify"**

**Step 6: Create Profile**
- Enter First Name
- Enter Last Name
- Choose Username (optional)
- Upload Profile Picture (optional)
- Click **"Create Account"**

**Step 7: Welcome!**
- They're now a member of your community
- Redirected to the main app

---

### ✅ Member Joined!

New members will appear in your **Members** list on the dashboard.

---

# PART 7: Managing Your Community

## 7.1: View All Members

1. Click **"Members"** in the menu
2. You'll see a list of all members with:
   - Name
   - Email
   - Join date
   - Status (online/offline)
   - Role

### Member Actions

Click on a member to:
- View their profile
- Send direct message
- Change their role (if applicable)
- Remove from community (if needed)

## 7.2: View Stakeholders

1. Click **"Stakeholders"** in the menu
2. See all VIP members with their badges
3. Filter by badge type (Vendor, Partner, etc.)

## 7.3: Create Channels

Channels are chat rooms for different topics.

1. Look for **"Channels"** or **"+"** button
2. Click **"Create Channel"**
3. Enter:
   - **Channel Name:** e.g., "General", "Announcements", "Help"
   - **Description:** What this channel is for
   - **Type:** Text or Voice
4. Click **"Create"**

### Suggested Channels

| Channel Name | Purpose |
|--------------|---------|
| #general | Main chat for everyone |
| #announcements | Official updates (admin only posting) |
| #help-support | Member questions |
| #introductions | New members introduce themselves |
| #events | Upcoming events |

## 7.4: Make Announcements

1. Go to your **#announcements** channel
2. Type your message
3. Send it - all members can see it

---

# Quick Reference Card

## Important URLs

| Purpose | URL |
|---------|-----|
| Super Admin Signup | `/super-admin-signup` |
| Admin Login | `/admin-login` |
| Member Signup | `/member-signup` |
| Stakeholder Signup | `/stakeholder-signup` (via invite link) |
| Main App | `/` or `/(main)` |

## User Roles Summary

| Role | How They Join | What They Can Do |
|------|---------------|------------------|
| **Super Admin** | Secret key signup | Everything - platform owner |
| **CU Admin** | Email invite from Super Admin | Manage their Credit Union |
| **Stakeholder** | Email invite from CU Admin | Member + VIP badge |
| **Member** | Invite code from CU Admin | Chat, calls, basic features |

## Key Actions by Role

### Super Admin Can:
- ✅ Create Credit Union customers
- ✅ Monitor all platform activity
- ✅ Manage platform settings
- ✅ View all customers and stats

### CU Admin Can:
- ✅ Customize their server
- ✅ Invite stakeholders
- ✅ Invite members (share invite code)
- ✅ Create and manage channels
- ✅ Moderate their community
- ❌ Cannot see other Credit Unions

### Stakeholder Can:
- ✅ Chat and message
- ✅ Make voice/video calls
- ✅ Has special badge visible
- ❌ Cannot invite others
- ❌ Cannot manage server

### Member Can:
- ✅ Chat and message
- ✅ Make voice/video calls
- ✅ Update their profile
- ❌ Cannot invite others
- ❌ Cannot manage server

---

# Troubleshooting Common Issues

## "Invalid Invite Code"
- Check the code is typed correctly (case-sensitive)
- Ask admin for a new code - it may have expired

## "Email Already Exists"
- User already has an account
- They should use **Login** instead of **Signup**

## "Invalid Secret Key" (Super Admin)
- Use exactly: `GRYD_SUPER_ADMIN_2024`
- Check for extra spaces
- Contact developer if changed

## "Setup Link Expired"
- Links expire after 7 days
- Super Admin needs to resend the invitation

## Member Can't Join
- Verify invite code is still valid
- Check if member limit reached (if applicable)
- Try generating a new invite code

---

# Summary: Complete Workflow

```
1. SUPER ADMIN creates account
         ↓
2. SUPER ADMIN creates Customer (Credit Union)
         ↓
3. CU ADMIN receives email invitation
         ↓
4. CU ADMIN completes setup (profile + server customization)
         ↓
5. CU ADMIN invites STAKEHOLDERS (by email)
         ↓
6. STAKEHOLDERS receive email, complete signup
         ↓
7. CU ADMIN shares INVITE CODE with members
         ↓
8. MEMBERS use code to join community
         ↓
9. Everyone can now chat, call, and connect! 🎉
```

---

**Congratulations!** You now know how to manage your entire GRYD platform from top to bottom.

For technical support, contact your developer.

---

*Document Version 1.0 | January 2026*
