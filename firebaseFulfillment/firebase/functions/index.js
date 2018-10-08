// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const config = require('./config.json')

const functions = require('firebase-functions');
const {WebhookClient, Payload, Card, Suggestion} = require('dialogflow-fulfillment');

const {Permission, BasicCard} = require('actions-on-google');

const 	admin = require('firebase-admin');
		admin.initializeApp(functions.config().firebase);

const 	db = admin.firestore();
		db.settings({timestampsInSnapshots: true});

var googleMapsClient = require('@google/maps').createClient({
  key: config.google
});

//const pg = require('pg');

console.log('WELCOME.72')

const connectionName = config.postgres.connectionName
const dbUser = config.postgres.dbUser
const dbPass = config.postgres.dbPass
const dbName = config.postgres.dbName

// const pool = new pg.Pool({
//     max: 1,
//     host: '/cloudsql/' + connectionName,
//     user: dbUser,
//     password: dbPass,
//     database: dbName
// });

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
	const agent = new WebhookClient({ request, response });

	console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
	console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

	const userId = request.body.originalDetectIntentRequest.payload.user.userId
	const params = request.body.queryResult.outputContexts
	const device = request.body.originalDetectIntentRequest.payload.device
	const queryText = request.body.queryResult.queryText

	function fallback(agent) {
		agent.add(`I didn't understand`);
		agent.add(`I'm sorry, can you try again?`);
	}

	function welcome(agent) {

		return db.collection('users').where('userId', '==', userId).get()
			.then(snapshot => {

				if(snapshot.size >= 1){
					agent.setFollowupEvent('actions_intent_GET_DESTINATION')

					//agent.add(`Welcome back, ${snapshot[0].name}. `);
				}else{
					agent.setFollowupEvent('actions_intent_GET_PREFERENCES')
				}

				return Promise.resolve('User exist check complete');
			})
			.catch(err => {
				console.log(err)
				agent.add(`Shit. Something went wrong.`);
			});


      // pool.query('SELECT NOW() as now', (error, results) => {

      //   agent.add(`YoYo`);

      // });
      
	}

  	function savePreferencesYes(agent){
  		savePreferences(agent, true)
  	}

  	function savePreferencesNo(agent){
  		savePreferences(agent, false)
  	}

	function savePreferences (agent, accessibility) {

		let new_user = db.collection('users').add({
			name: params[0].parameters.name,
			accessibility: accessibility,
			userId:userId
		}).then(ref => {
			agent.setFollowupEvent('actions_intent_GET_DESTINATION')
		})
		.catch(err => {
			console.log(err)
			agent.add(`Shit. Something went wrong.`);
		});
	}

	function getDestination(agent) {
		let conv = agent.conv();
	    conv.ask(new Permission({
	      context: 'Where are you right now?',
	      permissions: ['DEVICE_PRECISE_LOCATION'],
	    }))
	    agent.add(conv);
	}

	function getPermission (agent) {
		console.log('getPermission')

		let travel_mode = 'transit'

		if(queryText.indexOf('Car')>-1){
			travel_mode = 'driving'
		}else if(queryText.indexOf('Bike')>-1){
			travel_mode = 'bicycling'
		}else if(queryText.indexOf('Walking')>-1){
			travel_mode = 'walking'
		}else if(queryText.indexOf('Transit')>-1){
			travel_mode = 'transit'
		}

		let destination = '', departure_time = 'now'
		params.forEach(p=>{
			if(p.name.indexOf('getdestination-followup')>=0){
				destination = p.parameters.destination
				departure_time = p.parameters.departure_time
			}
		})

		if(device == undefined){
			console.log('intent_actions_NO_PERMISSION')
			agent.setFollowupEvent({
				name:'intent_actions_NO_PERMISSION', 
				parameters:{
					destination:destination, 
					departure_time:departure_time, 
					travel_mode:travel_mode
				}
			})
		}else{
			return buildDirections(destination, `${device.location.coordinates.latitude},${device.location.coordinates.longitude}`, departure_time, travel_mode)
		}
	}

	function getOrigin (agent){
		console.log('getOrigin')
		console.log(params)
		agent.add('OKIDO')
	}

	function buildDirections(destination, origin, departure_time, travel_mode){

		return new Promise(function(resolve,reject) {

			//https://maps.googleapis.com/maps/api/directions/json?origin=&destination=

			console.log({
			  origin: origin,
			  destination: destination + ', Berlin, Germany',
			  mode:travel_mode,
			  departure_time:departure_time
			})

			googleMapsClient.directions({
			  origin: origin,
			  destination: destination + ', Berlin, Germany',
			  mode:travel_mode,
			  departure_time:departure_time
			}, function(err, response) {
				if(err) throw err

				console.log(response.json.routes[0].legs[0])

				let card_str = ''

				response.json.routes[0].legs[0].steps.forEach((s,si)=>{

					console.log(si, s)

			    	let icon = '🚶'

			    	switch(s.travel_mode){
			    		case 'WALKING':
			    			icon = '🚶'
			    		break;
			    		case 'DRIVING':
			    			icon = '🚘'
			    		break;
			    		case 'CYCLING':
			    			icon = '🚲'
			    		break;
			    		case 'TRANSIT':
			    			switch(s.transit_details.line.vehicle.type){
			    				case 'BUS':
			    					icon = '🚍'
			    				break;
								case 'RAIL':
									icon = '🚆'
								break;
								case 'METRO_RAIL':
									icon = '🚆'
								break;
								case 'SUBWAY':
									icon = '🚇'
								break;
								case 'TRAM':
									icon = '🚊'
								break;
								case 'MONORAIL':
									icon = '🚆'
								break;
								case 'HEAVY_RAIL':
									icon = '🚆'
								break;
								case 'COMMUTER_TRAIN':
									icon = '🚆'
								break;
								case 'HIGH_SPEED_TRAIN':
									icon = '🚆'
								break;
								case 'BUS':
									icon = '🚍'
								break;
								case 'INTERCITY_BUS':
									icon = '🚍'
								break;
								case 'TROLLEYBUS':
									icon = '🚍'
								break;
								case 'SHARE_TAXI':
									icon = '🚍'
								break;
								case 'FERRY':
									icon = '🚍'
								break;
								case 'CABLE_CAR':
									icon = '🚊'
								break;
								case 'GONDOLA_LIFT':
									icon = '🚍'
								break;
								case 'FUNICULAR':
									icon = '🚍'
								break;
								case 'OTHER':
									icon = '🚍'
								break;
			    				case 'BUS':
			    					icon = '🚍'
			    				break;
			    				default:
			    					icon = '🚍'
			    				break;
			    			}
			    		break;
			    	}

			    	if(s.travel_mode == 'WALKING' && si == 0){
			    		
			    		card_str += `⊚\t${response.json.routes[0].legs[0].departure_time.text}\t${(response.json.routes[0].legs[0].start_address.split(','))[0]}\n  \n↓\t${icon}\t${s.duration.text}`

			    	}else if(s.travel_mode == 'WALKING' && si == response.json.routes[0].legs[0].steps.length-1){

			    		card_str += `\n  \n↓\t${icon}\t${s.duration.text}\n  \n⊚\t${response.json.routes[0].legs[0].arrival_time.text}\t\t${(response.json.routes[0].legs[0].end_address.split(','))[0]}`

			    	}else if(s.travel_mode == 'TRANSIT'){

			    		card_str += `\n  \n🚏\t${s.transit_details.departure_time.text}\t${s.transit_details.departure_stop.name}\n  \n↓\t${icon}\t${s.transit_details.line.short_name}\n  \n🚏\t${s.transit_details.arrival_time.text}\t${s.transit_details.arrival_stop.name}`

			    	}else if(s.travel_mode == 'WALKING'){

			    	}else if(s.travel_mode == 'CYCLING'){
			    		
			    	}else if(s.travel_mode == 'DRIVING'){
			    		
			    	}
			    })

			    let card = new Payload(agent.ACTIONS_ON_GOOGLE, {
				    "expectUserResponse": true,
				    "richResponse": {
				      "items": [
				        {
				          "simpleResponse": {
				            "textToSpeech": "Your trip:"
				          }
				        },
				        {
					      "basicCard": {
					        "formattedText":card_str,
					      }
					    }
				      ]
				    }
				  })

			    agent.add(card);

				//🚏🕔.∘⊙⊚
				//

				resolve('Routing done');
			});
		})

	}

	let intentMap = new Map();
	//intentMap.set('actions.intent.PERMISSION', getPermission);
	intentMap.set('GetDestination - yes - custom', getPermission)
	intentMap.set('GetDestination - yes - fallback', getPermission)
	intentMap.set('GetDestination - no - custom - fallback', getOrigin)
	intentMap.set('GetOrigin', getOrigin)
	intentMap.set('GetDestination', getDestination);
	intentMap.set('Default Welcome Intent', welcome);
	//intentMap.set('request_permission', requestPermission);
	intentMap.set('Default Fallback Intent', fallback);
	intentMap.set('GetPreferences - no - yes', savePreferencesNo);
	intentMap.set('GetPreferences - yes - yes', savePreferencesYes);
	agent.handleRequest(intentMap);
});
