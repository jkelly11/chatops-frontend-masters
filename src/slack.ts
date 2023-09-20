import type { Handler } from '@netlify/functions';

import { parse } from 'querystring'
import { blocks, modal, slackApi, verifySlackRequest  } from './util/slack';

async function handleSlashCommand (payload: SlackSlashCommandPayload) {
  switch (payload.command) {
    case '/test-bot':
      const testResponse = await slackApi('chat.postMessage', {
        channel: payload.channel_id, //response will be posted in same channel as request
        text: `🤖 I'm alive`
      })
      break;

    case '/weather':
      const weather = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.8408&longitude=-6.9261&hourly=temperature_2m&current_weather=true', 
      {
        headers: { accept: 'text/json'}
      })

      const weather_data = await weather.json();

      const temperature = `${weather_data.current_weather.temperature} ℃`
      const windSpeed = `${weather_data.current_weather.windspeed} km/h `

      const weatherResponse = await slackApi(
        'views.open',
        modal({
          id: 'weather-modal',
          title: 'What\'s the weather?',
          trigger_id: payload.trigger_id,
          blocks: [
            blocks.section({
              text: `💨 Windspeed = ${windSpeed}`
            }),
            blocks.section({
              text: `🌡️ Temperature = ${temperature}`
            }),
            blocks.input({
              id: 'opinion',
              label: 'How do you feel about that?',
              placeholder: 'Example: I wish it was warmer!',
              initial_value: payload.text ?? '',
              hint: 'Post your true feelings'
           }),
          ]
        })
      )

      break;
      
    default:
      return {
        statusCode: 200,
        body: `Command ${payload.command} is not recognised`
      }
  }

  //success. otherwise timeout error from slack
  return {
    statusCode: 200,
    body: ''
  }
}

async function handleInteractivity(payload: SlackModalPayload) {
  const callback_id = payload.callback_id ?? payload.view.callback_id;

  switch (callback_id) {
    case 'weather-modal':

      const data = payload.view.state.values;

      const reaction = data.opinion_block.opinion.value

      await slackApi('chat.postMessage', {
        channel: 'C05SN2CCFFA', // weather-reactions 
        text: `:eyes: <@${payload.user.id}> just checked the weather and reacted with ... *${reaction}*`
      })

      break;

    //   await slackApi('chat.postMessage', {
    //     channel: 'C05SFFP1L72',
    //     text: `:eyes: <@${payload.user.id}> just started a food fight with a ${fields.spiceLevel} take:\n\n*${fields.opinion}*\n\n discuss...`
    //   })

    //   break;

    default:
      console.log(`no handler defined for ${callback_id}`)
      return {
        statusCode: 400,
        body: `No handler defined for ${callback_id}`
      }
  }

  return {
    statusCode: 200,
    body: ''
  }
}

export const handler: Handler = async (event) => {
	//validation
  const valid = verifySlackRequest(event);

  if (!valid) {
    console.error('invalid request')
    return {
      statusCode: 400,
      body: 'invalid request'
    };
  }

  const body = parse(event.body ?? '') as SlackPayload;
  if (body.command) {
    return handleSlashCommand(body as SlackSlashCommandPayload);
  }

	// TODO handle interactivity (e.g. context commands, modals)
  if (body.payload) {
    const payload = JSON.parse(body.payload);
    return handleInteractivity(payload);
  }

	return {
		statusCode: 200,
		body: 'TODO: handle Slack commands and interactivity!!',
	};
};
