const express = require('express');
const { firestore } = require('firebase-admin');
const admin = require('firebase-admin')
const fs = require('fs');
const { stringify } = require('querystring');
const app = express()
const path = './credentials.json';

// Firebase Setup
if (fs.existsSync(path)) {
  var serviceAccount = require(path);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  admin.initializeApp();
}

const db = admin.firestore()
db.settings({ timestampsInSnapshots: true })

// Routes
app.get('/', (req, res) => res.send('online'))
app.post("/dialogflow", express.json(), (req, res) => {

  console.log('Dialogflow Request body: ' + JSON.stringify(req.body));

  let tag = req.body.fulfillmentInfo.tag;

  console.log('Tag: ', tag);
  // console.log('Session Info Parameters: ' + JSON.stringify(req.body.sessionInfo.parameters));

  function welcomeMessage(req, res) {
    let jsonResponse = {};
    jsonResponse = {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: ["Hi! This is a webhook response"]
            }
          }
        ]
      }
    };
    res.json(jsonResponse);
  }
  //checking through the DB and see if the the collection contains this docID: '(789)5464444'. if it does then get the name and pin inputs from user 
  async function check_database(req, res, db) {
    let jsonResponse = {};
    const botParametersDoc = await db.collection('abcCreditUnion').doc('(789)5464444').get();
    jsonResponse.sessionInfo = {
      parameters: {
        'Name': botParametersDoc.data().companyName,
        'pin': botParametersDoc.data().companyName
      }
    }
    res.json(jsonResponse);
    const data = botParametersDoc.data();
    console.log(JSON.stringify(data));
  }
  // gets what you want out of the string/JSON and removes the informaton that is not needed
  function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
  }

  async function vaildANI(req, res, db) {
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    console.log('ValidAni: ' + ani);
    const ranDoc2 = db.collection('abcCreditUnion');

    const Ran1 = await ranDoc2.where('PhoneNum', '==', ani).get();
    if (Ran1.empty) {
      jsonResponse = {
        fulfillment_response: {
          messages: [
            {
              text: {
                text: ["Invalid number. Please enter a correct one!"]
              }
            }
          ]
        },
        sessionInfo: {
          parameters: {
            'correct_answer': false,
            'number_updated': ani
          }
        }
      };
      console.log('Not a Valid Number:');
      res.json(jsonResponse);
      console.log('No matching documents.');
    }
    Ran1.forEach(doc1 => {
      let jsonResponse = {};
      jsonResponse.sessionInfo = {
        parameters: {
          'first_name': doc1.data().first_name,
          'last_name': doc1.data().last_name
        }
      }
      let firstName = doc1.data().first_name;
      let lastName = doc1.data().last_name;
      console.log('User Name is ' + firstName + " " + lastName)
      jsonResponse = {
        fulfillment_response: {
          messages: [
            {
              text: {
                text: ["Hello " + firstName + " " + lastName + " your phone number is " + ani]
              }
            }
          ]
        },
        sessionInfo: {
          parameters: {
            'correct_answer': true
          }
        }
      };
      console.log('Valid number');
      res.json(jsonResponse);
    });
  }
  //ln 131: gets number in paramters
  //ln 138: grabbing docid
  async function updatePhoneNumber(req, res, db) {
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    var document = "";
    console.log('ValidAni: ' + ani);
    let number_updated = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['number_updated']), '"', '');
    console.log(typeof (number_updated));
    db.collection("abcCreditUnion").get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        console.log(`${doc.id} => ${doc.data().PhoneNum}`)
        if (number_updated == ani) {
          document = doc.id;
          console.log('Number exists in DB');
        } else if (doc.data().PhoneNum == ani) {
          console.log("Updated Number");
          document = doc.id;
          const checkNum = db.collection("abcCreditUnion").doc(document);
          checkNum.update({ PhoneNum: number_updated });
        }
      });
    }
    );
    jsonResponse = {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: ["Your phone number has been updated to " + number_updated]
            }
          }
        ]
      }
    };
    res.json(jsonResponse);
  }
  //ln 165: gets from user
  //ln 167: gets the collection
  //ln 168: gets documents wherer number is eaqual
  //ln 170: searching through the document
  //ln 178: gets from the users
  async function check_pin(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    let checkPin = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['pin']), '"', '');
    const ranDoc2 = db.collection('abcCreditUnion');
    const Ran1 = await ranDoc2.where('PhoneNum', '==', ani).get();
    Ran1.forEach(doc1 => {
      jsonResponse.sessionInfo = {
        parameters: {
          'pin1': doc1.data().pin
        }
      }
      const data = doc1.data();
      const checkUserPin = JSON.stringify(doc1.data().pin);
      console.log(JSON.stringify(data));
      console.log(checkUserPin);
      if (checkPin === checkUserPin) {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Valid Pin "]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer3': true
            }
          }
        }
      } else if (checkPin != checkUserPin) {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Invalid Pin. "]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer3': false
            }
          }
        };

      }
      res.json(jsonResponse);
    })
  }
  //ln 224: gets from the entities
  async function check_security_question(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    console.log('ValidAni: ' + ani);
    const ranDoc2 = db.collection('abcCreditUnion');
    const Ran1 = await ranDoc2.where('PhoneNum', '==', ani).get();
    let checkSecQues1 = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['secans2']), '"', '');
    Ran1.forEach(doc1 => {
      jsonResponse.sessionInfo = {
        parameters: {
          'country': doc1.data().vaildSecurityQuestion,
          'first_name': doc1.data().first_name,
          'last_name': doc1.data().last_name,
        }
      }
      let firstName = doc1.data().first_name;
      let lastName = doc1.data().last_name;
      console.log('User Name is ' + firstName + " " + lastName);
      const data = doc1.data();
      const check = doc1.data().vaildSecurityQuestion;
      console.log(JSON.stringify(data));
      console.log(check);
      if (checkSecQues1 === check) {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Hello " + firstName + " " + lastName + " you have entered a Valid Security Question "]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer2': true
            }
          }
        };
      }
      else {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Invalid Security Question."]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer2': false
            }
          }
        };
      }
      res.json(jsonResponse);
    })
  }
  //Checks to see if the document is empty or not (ln 283)
  //gets the collection (ln 285)
  // gets documents wherer number is eaqual (ln 286)
  // searching through the document (ln 290)
  // gets the stuff (name, number and pin etc) (ln 294-298)
  async function check_security_question2(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    console.log('ValidAni: ' + ani);
    const ranDoc2 = db.collection('abcCreditUnion');
    const Ran1 = await ranDoc2.where('PhoneNum', '==', ani).get();
    let checkSecQues2 = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['securityquestion2answer']), '"', '');

    Ran1.forEach(doc1 => {
      jsonResponse.sessionInfo = {
        parameters: {
          'first_name': doc1.data().first_name,
          'last_name': doc1.data().last_name,
          'answer': doc1.data().validSecurityQuestion2
        }
      }
      let firstName = doc1.data().first_name;
      let lastName = doc1.data().last_name;
      console.log('User Name is ' + firstName + " " + lastName);
      const data = doc1.data();
      const check2 = doc1.data().validSecurityQuestion2;
      console.log(JSON.stringify(data));
      console.log(check2);
      if (checkSecQues2 === check2) {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Hello " + firstName + " " + lastName + " you have entered a Valid Security Question "]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer4': true
            }
          }
        };
      }
      else {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Invalid Security Question."]
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer4': false
            }
          }
        };
      }
      res.json(jsonResponse);
    })
  }

  switch (tag) {
    case "welcome":
      welcomeMessage(req, res)
      break;
    case "check_database":
      check_database(req, res, db);
      break;
    case "get_ani":
      vaildANI(req, res, db)
      break;
    case 'update_ani':
      updatePhoneNumber(req, res, db)
      break;
    case 'check_pin':
      check_pin(req, res, db)
      break;
    case 'check_security_question':
      check_security_question(req, res, db)
      break;
    case 'check_security_question2':
      check_security_question2(req, res, db)
      break;
    default:
      return res.status(404).send({ error: 'No Tag' });
  }

});

module.exports = app