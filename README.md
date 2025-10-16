TaskHub Project
=====================

Run the app.
--------------------------------
1. Installing the dependencies:
   
   npm install or npm i
   
2. Seeding the database with data:
   
   npm run seed
   
   This script creates the tables  and fills in the rows with mock data.

3. Starting the server:
   
   npm run dev
   
   The app runs at http://localhost:3000
   port can be modified in app.js in line 82 
   const PORT = process.env.PORT || 3000;

Database info
---------------------
- I added samples for workshops and team members so the requirements of 10 rows and 5 tables are covered right away after running the seed script.
- The seed script can be re-run if you want to reset the data to the original state.
- The credntials for admin login (admin / wdf#2025)

Notes about tools I used
------------------------------
- I have more than 5 tables, pagination, user managment system, hashed passwords and everything it asks about.
- I used VS Code auto complete (with Copilot AI) on some files and it helped when adding comments.
- I got a little help from AI for the database seeding logic and again when the CSS and UI styles.
- I used Grid and flexbox for the responsiveness in the website to work on other devices.


Extra tips
----------
- Run `npm run seed` again if the database gets out of sync.
- The `/public/assets` folder has the background wallpaper video used and an image iif needed to change it.