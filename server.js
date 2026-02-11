import express from "express";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index.html");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});