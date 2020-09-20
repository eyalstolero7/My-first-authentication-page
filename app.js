//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const e = require("express");

const app = express();

app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true);

const secretSchema = new mongoose.Schema({
    content: String,
});

const Secret = new mongoose.model("Secret", secretSchema);

const userSchema = new mongoose.Schema({
    email: { type: String, unique: false, required: false },
    password: String,
    googleId: String,
    facebookId: String,
    secrets: [secretSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/secrets",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        function (accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    username: profile.emails[0].value,
                    $or: [
                        { googleId: profile.id },
                        { facebookId: { $ne: null } },
                        { password: { $ne: null } },
                    ],
                },
                function (err, user) {
                    return cb(err, user);
                }
            );
        }
    )
);

app.get("/", function (req, res) {
    res.render("home");
});

app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
    "/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/secrets");
    }
);

passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: "http://localhost:3000/auth/facebook/secrets",
            profileFields: ["id", "emails", "name"],
        },
        function (accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    username: profile.emails[0].value,
                    $or: [
                        { facebookId: profile.id },
                        { googleId: { $ne: null } },
                        { password: { $ne: null } },
                    ],
                },
                function (err, user) {
                    return cb(err, user);
                }
            );
        }
    )
);

app.get(
    "/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
    "/auth/facebook/secrets",
    passport.authenticate("facebook", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    }
);

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
        User.find({ secrets: { $ne: null } }, function (err, foundUsers) {
            if (err) {
                console.log(err);
            } else if (foundUsers) {
                res.render("secrets", {
                    users: foundUsers,
                });
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.route("/submit")
    .get(function (req, res) {
        if (req.isAuthenticated()) {
            res.render("submit");
        } else {
            res.redirect("/login");
        }
    })
    .post(function (req, res) {
        const submittedSecret = new Secret({ content: req.body.secret });

        User.findById(req.user.id, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.secrets.push(submittedSecret);
                    foundUser.save(function () {
                        res.redirect("/secrets");
                    });
                }
            }
        });
    });

app.route("/login")
    .get(function (req, res) {
        res.render("login", {
            wrongLogin: "",
        });
    })
    .post(function (req, res) {
        const user = new User({
            username: req.body.username,
            password: req.body.password,
        });

        req.login(user, function (err) {
            if (err) {
                console.log(err);
            } else {
                passport.authenticate("local", {
                    failureRedirect: "/login-bc",
                })(req, res, function () {
                    res.redirect("/secrets");
                });
            }
        });
    });

app.get("/login-bc", function (req, res) {
    res.render("login", {
        wrongLogin:
            "* Email doesn't exists or email and password doesn't match.",
    });
});

app.route("/register")
    .get(function (req, res) {
        res.render("register", {
            wrongLogin: "",
        });
    })
    .post(function (req, res) {
        User.register(
            { username: req.body.username },
            req.body.password,
            function (err, user) {
                if (err) {
                    res.render("register", { wrongLogin: err.message });
                } else {
                    passport.authenticate("local")(req, res, function () {
                        res.redirect("/secrets");
                    });
                }
            }
        );
    });

app.listen(process.env.PORT || 3000, function () {
    console.log("Server started on port 3000");
});
