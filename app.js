// подключение
const express = require("express");
const app = express();

const port = 3000;
// env
const env = require('dotenv').config();

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});


// ejs
app.set('view engine', 'ejs');


// ▼▼▼▼ body-parser ▼▼▼▼, теперь его не нужно импортировать отдельно, достаточно написать такой код:
app.use(express.urlencoded({
    extended: true
}));


// ▼▼▼▼ подключил css ▼▼▼▼
app.use(express.static(__dirname + '/public'));

// mongoose ВАЖНО ПОСЛЕ 27017 УКАЗЫВАЕТСЯ НАЗВАНИЕ DATABASE. В МОЕМ СЛУЧАЕ БЫЛО test, далее я изменю его на todolistDB. РАНЕЕ ИЗ ЗА ЭТОГО Я ЖЕСТКО ЗАТУПИЛ И НЕ МОГ ПОНЯТЬ КУДА СОХРАНЯЮТСЯ ЛЮДИ(person). А ОКАЗЫВАЕТСЯ ОНИ СОХРАНЯЛИСЬ В БАЗУ ФРУКТОВ(fruitsDB), и внутри fruitsDB уже были people. то есть это была не отдельная база.
// А ИМЕННО БАЗА ИЗНАЧАЛЬНО УКАЗЫВАЕТСЯ ЗДЕСЬ
const mongoose = require("mongoose");

mongoose.set('useCreateIndex', true);
mongoose.connect('mongodb://localhost:27017/userDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// подключение express-session
const session = require('express-session');

// подключение passport
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
// google auth
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// подключение findOrCreate
const findOrCreate = require('mongoose-findorcreate');



app.use(session({
    secret: 'Our little secret',
    resave: false,
    saveUninitialized: false
}));



app.use(passport.initialize());
app.use(passport.session());


// users collection
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

// passport plugin
userSchema.plugin(passportLocalMongoose);

// findorcreate plugin
userSchema.plugin(findOrCreate);


const User = mongoose.model('User', userSchema);


passport.use(User.createStrategy());

// serializeUser/deserealizeUser
passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});


// google passport auth
passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({
            googleId: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));


// get

app.get("/", (req, res) => {
    res.render("home");
});

app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['email', 'profile']
    }));

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        successRedirect: '/auth/google/success',
        failureRedirect: '/auth/google/failure'
    }));

app.get("/login", (req, res) => {
    res.render("login");
});

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
    User.find({
        'secret': {
            $ne: null
        }
    }, (err, foundUsers) => {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {
                res.render('/secrets', {
                    usersWithSecrets: foundUsers
                });
            }
        }
    });
});

app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/register", (req, res) => {
    User.register({
        username: req.body.username
    }, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect('/register');
        } else {
            passport.authenticate('local')(req, res, () => {
                res.redirect('/secrets');
            });
        }
    });
});

app.post("/login", (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, () => {
                res.redirect('/secrets');
            });
        }
    });
});

app.post('/submit', (req, res) => {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, (err, foundUser) => {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(() => {
                    res.redirect('/secrets');
                });
            }
        }
    });
});

