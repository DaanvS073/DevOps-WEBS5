const amqplib = require("amqplib");

let channel = null;

async function connect() {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL || "amqp://localhost");
  channel = await conn.createChannel();
  return channel;
}

function getChannel() {
  return channel;
}

async function publishMessage(queue, message) {
  if (!channel) await connect();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}

async function consumeMessages(queue, callback) {
  if (!channel) await connect();
  await channel.assertQueue(queue, { durable: true });
  channel.consume(queue, (msg) => {
    if (msg) {
      const content = JSON.parse(msg.content.toString());
      callback(content);
      channel.ack(msg);
    }
  });
}

module.exports = { connect, getChannel, publishMessage, consumeMessages };
