import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "./errors";

export enum UserRole {
  TEACHER = "teacher",
  LEARNER = "learner",
}

export enum Dialects {
  WEST = "North Island western",
  EAST = "North Island eastern",
  SOUTH = "South Island",
}

export interface UserDoc extends BaseDoc {
  username: string;
  password: string;
  role: UserRole;
  description: string;
  dialect: Dialects;
}

/**
 * concept: Profiling
 */
export default class ProfilingConcept {
  public readonly profiles: DocCollection<UserDoc>;

  /**
   * Make an instance of Profiling.
   */
  constructor(collectionName: string) {
    this.profiles = new DocCollection<UserDoc>(collectionName);
    // Create index on username to make search queries for it performant
    void this.profiles.collection.createIndex({ username: 1 });
  }

  async create(username: string, password: string, description: string, role: UserRole, dialect: Dialects) {
    await this.assertGoodCredentials(username, password);
    const _id = await this.profiles.createOne({ username, password, description, role, dialect });
    return { msg: "Profile created successfully!", user: await this.profiles.readOne({ _id }) };
  }

  private redactPassword(profile: UserDoc): Omit<UserDoc, "password"> {
    // eslint-disable-next-line
    const { password, ...rest } = profile;
    return rest;
  }

  async getUserById(_id: ObjectId) {
    const user = await this.profiles.readOne({ _id });
    if (user === null) {
      throw new NotFoundError(`User not found!`);
    }
    return this.redactPassword(user);
  }

  async getUserByUsername(username: string) {
    const user = await this.profiles.readOne({ username });
    if (user === null) {
      throw new NotFoundError(`Profile not found!`);
    }
    return this.redactPassword(user);
  }

  async idsToUsernames(ids: ObjectId[]) {
    const profiles = await this.profiles.readMany({ _id: { $in: ids } });

    // Store strings in Map because ObjectId comparison by reference is wrong
    const idToProfile = new Map(profiles.map((profile) => [profile._id.toString(), profile]));
    return ids.map((id) => idToProfile.get(id.toString())?.username ?? "DELETED_PROFILE");
  }

  async getProfiles(username?: string) {
    // If username is undefined, return all profiles by applying empty filter
    const filter = username ? { username } : {};
    const profiles = (await this.profiles.readMany(filter)).map(this.redactPassword);
    return profiles;
  }

  async authenticate(username: string, password: string) {
    const profile = await this.profiles.readOne({ username, password });
    if (!profile) {
      throw new NotAllowedError("Username or password is incorrect.");
    }
    return { msg: "Successfully authenticated.", _id: profile._id };
  }

  async updateUsername(_id: ObjectId, username: string) {
    await this.assertUsernameUnique(username);
    await this.profiles.partialUpdateOne({ _id }, { username });
    return { msg: "Username updated successfully!" };
  }

  async updatePassword(_id: ObjectId, currentPassword: string, newPassword: string) {
    const profile = await this.profiles.readOne({ _id });
    if (!profile) {
      throw new NotFoundError("Profile not found");
    }
    if (profile.password !== currentPassword) {
      throw new NotAllowedError("The given current password is wrong!");
    }

    await this.profiles.partialUpdateOne({ _id }, { password: newPassword });
    return { msg: "Password updated successfully!" };
  }

  async updateDescription(_id: ObjectId, description: string) {
    await this.profiles.partialUpdateOne({ _id }, { description });
    return { msg: "Description updated successfully!" };
  }

  async updateRole(_id: ObjectId, role: UserRole) {
    await this.profiles.partialUpdateOne({ _id }, { role });
    return { msg: "Role updated successfully!" };
  }

  async updateDialect(_id: ObjectId, dialect: Dialects) {
    await this.profiles.partialUpdateOne({ _id }, { dialect });
    return { msg: "Dialect updated successfully!" };
  }

  async delete(_id: ObjectId) {
    await this.profiles.deleteOne({ _id });
    return { msg: "Profile deleted!" };
  }

  async assertProfileExists(_id: ObjectId) {
    const maybeProfile = await this.profiles.readOne({ _id });
    if (maybeProfile === null) {
      throw new NotFoundError(`Profile not found!`);
    }
  }

  async assertProfileIsTeacher(_id: ObjectId) {
    const profile = await this.profiles.readOne({ _id });
    if (profile!.role !== UserRole.TEACHER) {
      throw new NotAllowedError(`User does not have teacher privileges!`);
    }
  }

  private async assertGoodCredentials(username: string, password: string) {
    if (!username || !password) {
      throw new BadValuesError("Username and password must be non-empty!");
    }
    await this.assertUsernameUnique(username);
  }

  private async assertUsernameUnique(username: string) {
    if (await this.profiles.readOne({ username })) {
      throw new NotAllowedError(`User with username ${username} already exists!`);
    }
  }
}
