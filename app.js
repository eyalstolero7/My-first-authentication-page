//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const md5 = require("md5");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
});

const User = new mongoose.model("User", userSchema);

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/logout", function (req, res) {
    res.redirect("/");
});

app.get("/secrets", function (req, res) {
    res.render("secrets");
});

app.route("/login")
    .get(function (req, res) {
        res.render("login", {
            wrongLogin: "",
        });
    })
    .post(function (req, res) {
        const username = req.body.username;
        const password = md5(req.body.password);

        User.findOne({ email: username }, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else if (foundUser && foundUser.password === password) {
                res.redirect("/secrets");
            } else {
                res.render("login", {
                    wrongLogin:
                        "* Email doesn't exists or the password doesn't match!",
                });
            }
        });
    });

app.route("/register")
    .get(function (req, res) {
        res.render("register");
    })
    .post(function (req, res) {
        const user = new User({
            email: req.body.username,
            password: md5(req.body.password),
        });
        user.save(function (err) {
            if (err) {
                console.log(err);
            } else {
                res.redirect("/secrets");
            }
        });
    });

app.listen(process.env.PORT || 3000, function () {
    console.log("Server started on port 3000");
});
