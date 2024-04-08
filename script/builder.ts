// create json but not on runtime
import { SlashCommandBuilder } from "discord.js";
import { join, dirname } from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const CREATE_SET_ROLE_MESSAGE = new SlashCommandBuilder()
  .setName('create-set-role-message')
  .setDescription('Create a message to grant the role. Max: 5 roles.')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('The message to send')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('role1')
      .setDescription('The role to grant 1')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('role2')
      .setDescription('The role to grant 2')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('role3')
      .setDescription('The role to grant 3')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('role4')
      .setDescription('The role to grant 4')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('role5')
      .setDescription('The role to grant 5')
      .setRequired(false)
  )
  .toJSON();

const outputPath = join(__dirname, '../src', 'commands.json');
await fs.writeFile(outputPath, JSON.stringify({ CREATE_SET_ROLE_MESSAGE }, null, 2));
