import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface UpvoteDoc extends BaseDoc {
  item: ObjectId;
  upvotes: Set<ObjectId>;
  downvotes: Set<ObjectId>;
  reviewers: Set<ObjectId>;
}

/**
 * concept: Rating[Content]
 */
export default class UpvotingConcept {
  public readonly upvotes: DocCollection<UpvoteDoc>;

  /**
   * Make a ratings instance
   */
  constructor(name: string) {
    this.upvotes = new DocCollection<UpvoteDoc>(name);
  }

  async getVotes(item: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    return { msg: "votes found", votes: upvotes };
  }

  async upvoteItem(item: ObjectId, user: ObjectId) {
    await this.assertUserIsReviewer(item, user);
    await this.assertUserNotInDownvotes(item, user);
    await this.assertUserNotInUpvotes(item, user);
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    const newUpvotes = upvotes.upvotes;
    newUpvotes.add(user);
    await this.upvotes.partialUpdateOne({ item: item }, { upvotes: newUpvotes });
    return { msg: "Upvoted" };
  }

  async downvoteItem(item: ObjectId, user: ObjectId) {
    await this.assertUserIsReviewer(item, user);
    await this.assertUserNotInDownvotes(item, user);
    await this.assertUserNotInUpvotes(item, user);
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    const newDownvotes = upvotes.downvotes;
    newDownvotes.add(user);
    await this.upvotes.partialUpdateOne({ item: item }, { upvotes: newDownvotes });
    return { msg: "Downvoted" };
  }

  async removeUpvote(item: ObjectId, user: ObjectId) {
    await this.assertUserInUpvotes(item, user);
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    const newUpvotes = upvotes.upvotes;
    newUpvotes.delete(user);
    await this.upvotes.partialUpdateOne({ item: item }, { upvotes: newUpvotes });
    return { msg: "Upvote removed" };
  }

  async removeDownvote(item: ObjectId, user: ObjectId) {
    await this.assertUserInDownvotes(item, user);
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    const newDownvotes = upvotes.downvotes;
    newDownvotes.delete(user);
    await this.upvotes.partialUpdateOne({ item: item }, { upvotes: newDownvotes });
    return { msg: "Downvote removed" };
  }

  async getUpvoteCount(item: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    return { numberUpvotes: upvotes.upvotes.size };
  }

  async getDownvoteCount(item: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    return { numberUpvotes: upvotes.downvotes.size };
  }

  async assertUserIsReviewer(item: ObjectId, user: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    if (!upvotes.reviewers.has(user)) {
      throw new NotAllowedError(`User ${user} not in Reviewers`);
    }
  }

  async assertUserNotInUpvotes(item: ObjectId, user: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    if (upvotes.downvotes.has(user)) {
      throw new NotAllowedError(`User ${user} in upvotes`);
    }
  }

  async assertUserNotInDownvotes(item: ObjectId, user: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    if (upvotes.upvotes.has(user)) {
      throw new NotAllowedError(`User ${user} in downvotes`);
    }
  }

  async assertUserInUpvotes(item: ObjectId, user: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    if (!upvotes.downvotes.has(user)) {
      throw new NotAllowedError(`User ${user} not in upvotes`);
    }
  }

  async assertUserInDownvotes(item: ObjectId, user: ObjectId) {
    const upvotes = await this.upvotes.readOne({ item: item });
    if (!upvotes) {
      throw new NotFoundError(`Item ${item} does not exist!`);
    }
    if (!upvotes.upvotes.has(user)) {
      throw new NotAllowedError(`User ${user} not in downvotes`);
    }
  }
}
