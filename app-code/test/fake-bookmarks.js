'use strict';

module.exports = {
  generateRandomData
};

// Make sure to "npm install faker" first.
const Faker = require('faker');

let users = ["john.adams", "george.washington", "thomas.jefferson", "ben.franklin", "james.madison", "alexander.hamilton"];

function generateRandomData(userContext, events, done) {
  // generate data with Faker:
  let uuid = Faker.datatype.uuid();
  const url = Faker.internet.url();
  const name = Faker.lorem.words();
  const description = Faker.lorem.text();
  // add variables to virtual user's context:
  userContext.vars.uid = uuid;
  userContext.vars.name = name;
  userContext.vars.url = url;
  userContext.vars.description = description;


  userContext.vars.username = users[getRandomInt(5)];

  //10% of bookmarks are sharable
  if(getRandomInt(10) < 1)
    userContext.vars.shareFlag = true;
  else
    userContext.vars.shareFlag = false;

  return done();
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
