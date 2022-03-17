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
  //gets what you want out of the string/JSON and removes the informaton that is not needed
  function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
  }
  //checking to see if the user has entered a valid number. If they have and see if that corresponds to a number in the db and make that 
  //number have all the data ssociated w it. Line 80 will display msg when the user enter an invlaid number and ask user to enter the correct one
  //that is assocaited w the account. If the number is correct and matches in the DB then line 113 will display the msg to the front end.
  async function vaildANI(req, res, db) {
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    console.log('ValidAni: ' + ani);
    const collection_name = db.collection('abcCreditUnion');

    const number = await collection_name.where('PhoneNum', '==', ani).get();
    if (number.empty) {
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
    number.forEach(docData => {
      let jsonResponse = {};
      jsonResponse.sessionInfo = {
        parameters: {
          'first_name': docData.data().first_name,
          'last_name': docData.data().last_name
        }
      }
      let firstName = docData.data().first_name;
      let lastName = docData.data().last_name;
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
  //This method is updating the phonenumber in the db. When the user enters a number that is not in the DB and are prompted w the msg "I
  //noticed that you are calling from a new number. Would you like to update it" This method will allows them to update it when they type "yes in
  //Dialog Flow CX". if user says that they want to update their number they will be prompted w the msg in line 157. 
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
          const checkNum = db.collection("abcCreditUnion").doc(document)
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
  //This Method is checking if the user enters the correct pin associated w their account. Line 171 checks and sees if the number that is already
  //in the DB matches the inforamtion associated w the number.
  async function check_pin(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    let checkPin = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['pin']), '"', '');
    const collection_name = db.collection('abcCreditUnion');
    const number = await collection_name.where('PhoneNum', '==', ani).get();
    number.forEach(docData => {
      jsonResponse.sessionInfo = {
        parameters: {
          'pin1': docData.data().pin
        }
      }
      const data = docData.data();
      const checkUserPin = JSON.stringify(docData.data().pin);
      console.log(JSON.stringify(data));
      console.log(checkUserPin);
      if (checkPin === checkUserPin) {
        jsonResponse = {
          fulfillment_response: {
            messages: [
              {
                text: {
                  text: ["Valid Pin "] //will be displayed if they enter the right pin
                }
              }
            ]
          },
          sessionInfo: {
            parameters: {
              'correct_answer3': true //user enters the correct pin Dialoglfow cx will be able to proceed to next step.
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
              'correct_answer3': false //user enters the wrong pin Dialoglfow cx will not be able to proceed to next step.
            }
          }
        };

      }
      res.json(jsonResponse);
    })
  }
  //Checks the first security question that the user enters in the db. If they enter the correct security question they are propted with a welcome msg.
  async function check_security_question(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', '');
    console.log('ValidAni: ' + ani);
    const collection_name = db.collection('abcCreditUnion');
    const number = await collection_name.where('PhoneNum', '==', ani).get();
    let checkSecQues1 = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['secans2']), '"', '');
    number.forEach(docData => {
      jsonResponse.sessionInfo = {
        parameters: {
          'country': docData.data().vaildSecurityQuestion,
          'first_name': docData.data().first_name,
          'last_name': docData.data().last_name,
        }
      }
      let firstName = docData.data().first_name;
      let lastName = docData.data().last_name;
      console.log('User Name is ' + firstName + " " + lastName);
      const data = docData.data();
      const check = docData.data().vaildSecurityQuestion;
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

  //this function is ran when the user fails the first Sec Question. If they fail the first one they need to provide a valid answer for the 2nd
  //sec question. If they provide a valid answer for the 2nd sec ques they are provdied with a welcome msg. If they fail both sec questions they
  //will not be able to be authenticed.
  async function check_security_question2(req, res, db) {
    let jsonResponse = {};
    let ani = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['ani']), '"', ''); //Checks to see if the document is empty or not (ln 291)
    console.log('ValidAni: ' + ani);
    const collection_name = db.collection('abcCreditUnion');//gets the collection (ln 293)
    const number = await collection_name.where('PhoneNum', '==', ani).get(); // gets documents wherer number is eaqual (ln 294)
    let checkSecQues2 = replaceAll(JSON.stringify(req.body.sessionInfo.parameters['securityquestion2answer']), '"', '');

    number.forEach(docData => {// gets the stuff (name, number and pin etc) (ln 298-304)
      jsonResponse.sessionInfo = {
        parameters: {
          'first_name': docData.data().first_name,
          'last_name': docData.data().last_name,
          'answer': docData.data().validSecurityQuestion2
        }
      }
      let firstName = docData.data().first_name;
      let lastName = docData.data().last_name;
      console.log('User Name is ' + firstName + " " + lastName);
      const data = docData.data();
      const check2 = docData.data().validSecurityQuestion2;
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