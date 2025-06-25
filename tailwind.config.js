 /** @type {import('tailwindcss').Config} */  
 module.exports = {  
  content: ['./views/**.njk'],  
  theme: {  
      extend: {},  
  },  
  plugins: [  
      {  
          tailwindcss: {},  
          autoprefixer: {},  
      },  
  ],  
};
