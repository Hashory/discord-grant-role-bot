import { verifyKey } from 'discord-interactions';
import {
  ApplicationCommandType,
  APIMessageApplicationCommandInteraction,
  APIMessageComponentInteraction,
  APIInteraction,
  ButtonStyle,
  InteractionType,
  InteractionResponseType,
  APIRole,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import ky from 'ky';

type Env = {
  DISCORD_PUBLIC_KEY: string; // public key for verifying requests
  DISCORD_APPLICATION_ID: string; // application id for oauth
  DISCORD_TOKEN: string; // bot token
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method === 'GET') {
      return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
    }
    const { isValid, interaction } = (await verifyDiscordRequest(
      request,
      env,
    )) as { isValid: boolean; interaction: APIInteraction };
    if (!isValid || !interaction) {
      return new Response('Bad request signature.', { status: 401 });
    }
    if (interaction.type === InteractionType.Ping) {
      return Response.json({ type: InteractionResponseType.Pong });
    }
    if (
      interaction.type === InteractionType.ApplicationCommand &&
      interaction.data.type === ApplicationCommandType.ChatInput
    ) {
      // Most user commands will come as `APPLICATION_COMMAND`.
      interaction as APIMessageApplicationCommandInteraction;

      function isValidOption(option: any): option is { value: string } {
        return option && typeof option.value === 'string';
      }

      const guildId = interaction.guild_id;
      const option = interaction.data.options
        ? interaction.data.options[0]
        : null;
      const message = isValidOption(option) ? option.value : 'No message';

      // get role data
      const guildData: APIRole[] = await ky
        .get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${env.DISCORD_TOKEN}`,
          },
        })
        .json();

      console.log(interaction);
      console.log(guildData);

      // if has higher role
      const interactionUserRolePosition =
        interaction.member?.roles
          .map(
            (role) =>
              guildData.filter((guildRole) => guildRole.id === role)[0]
                .position,
          )
          .sort((a, b) => b - a)[0] ?? 0;
      const botRolePosition = guildData.filter(
        (role) => role.tags?.bot_id == env.DISCORD_APPLICATION_ID,
      )[0].position;
      if (interactionUserRolePosition >= botRolePosition) {
        const buttons = interaction.data.options
          ?.filter(
            (option) => option.type === ApplicationCommandOptionType.Role,
          )
          .map((option) => {
            const optionValue = isValidOption(option)
              ? option.value
              : 'No Role Value';

            const roleName = guildData.filter(
              (role) => role.id === optionValue,
            )[0].name;
            return new ButtonBuilder()
              .setCustomId(optionValue)
              .setLabel(roleName)
              .setStyle(ButtonStyle.Primary);
          });

        return Response.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: message,
            components: [
              new ActionRowBuilder()
                .addComponents(buttons ? buttons : [])
                .toJSON(),
            ],
          },
        });
      } else {
        return Response.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: 'You do not have permission to use this command.',
            flags: 64,
          },
        });
      }
    }
    if (interaction.type === InteractionType.MessageComponent) {
      // Grant and Remove role
      interaction as APIMessageComponentInteraction;

      const roleId = interaction.data.custom_id as string;
      const user = interaction.member?.user;
      const guildId = interaction.guild_id;
      const token = interaction.token;

      // if not, grant the role
      try {
        if (!interaction.member?.roles.includes(roleId)) {
          // grant the role
          await ky.put(
            `https://discord.com/api/v10/guilds/${guildId}/members/${user?.id}/roles/${roleId}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bot ${env.DISCORD_TOKEN}`,
              },
            },
          );

          return Response.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: `Role <@&${roleId}> granted to <@!${user?.id}>.`,
              flags: 64,
            },
          });
        } else {
          // remove the role
          await ky.delete(
            `https://discord.com/api/v10/guilds/${guildId}/members/${user?.id}/roles/${roleId}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bot ${env.DISCORD_TOKEN}`,
              },
            },
          );
          return Response.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: `Role <@&${roleId}> removed from <@!${user?.id}>`,
              flags: 64,
            },
          });
        }
      } catch (e) {
        console.error(e);
        return Response.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `An error has occurred.`,
            flags: 64,
          },
        });
      }
    }
    return Response.json({ error: 'Unknown Type' }, { status: 400 });
  },
};

async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!isValidRequest) {
    return { isValid: false };
  }
  return { interaction: JSON.parse(body), isValid: true };
}
