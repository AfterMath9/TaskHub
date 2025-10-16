TaskHub Project
=====================
Student 1: Amrou Al Mfalani  
Student 2: Abdelhamid MHD Amjad Darwish

TaskHub is a to-do list application where users can register or log in to view primary tasks added by the admin or create their own personal tasks. They can also browse upcoming workshops with their assigned classrooms, review team members, upload images, and update their profile data.
--------------------------------

Run the app.
--------------------------------
1. Installing the dependencies:
   
   npm install or npm i
   
2. Seeding the database with sample data:
   
   npm run seed
   
   This script creates the tables and populates them with mock data.

3. Starting the server:
   
   npm run dev
   
   The app runs at http://localhost:3000
   Port can be modified in app.js on line 82 
   const PORT = process.env.PORT || 3000;

Database info
---------------------
- Sample data for workshops and team members ensures the 10-row, 5-table requirement is met immediately after running the seed script.
- You can re-run the seed script at any time to reset the data to its original state.
- Admin login credentials: (admin / wdf#2025)

Notes about tools I used
------------------------------
- The project includes more than five tables, pagination, a user management system, hashed passwords, and the other requested features.
- I used VS Code autocomplete (with Copilot AI) on some files, which was helpful for adding comments.
- I relied on AI assistance for the database seeding logic and when refining the CSS and overall UI.
- Grid and Flexbox ensure the layout is responsive across devices.


Extra tips
----------
- Run `npm run seed` again if the database gets out of sync.
- The `/public/assets` folder contains the background wallpaper video and an image if you want to swap them out.
