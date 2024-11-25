import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface DictionaryDoc extends BaseDoc {
  word: string;
  posts: ObjectId[];
}

/**
 * concept: Dictionarying [Post]
 */
export default class DictionaryingConcept {
  public readonly dictionary: DocCollection<DictionaryDoc>;

  constructor(collectionName: string) {
    this.dictionary = new DocCollection<DictionaryDoc>(collectionName);
  }

  async createEntry(word: string, post: ObjectId) {
    await this.assertEntryAlreadyExists(word);
    const _id = await this.dictionary.createOne({
      word,
      posts: [post],
    });

    return {
      msg: "Entry successfully added!",
      entry: await this.dictionary.readOne({ _id }),
    };
  }

  async deleteEntry(word: string) {
    await this.assertEntryExists(word);
    const entry = await this.dictionary.popOne({ word });
    return {
      msg: "Entry successfully deleted",
      entry,
    };
  }

  async addItem(word: string, item: ObjectId) {
    await this.assertEntryExists(word);
    const entry = await this.dictionary.readOne({ word });
    await this.dictionary.partialUpdateOne({ word }, { posts: entry?.posts.concat(item) });
  }

  async deleteItem(word: string, item: ObjectId) {
    const entry = await this.dictionary.readOne({ word });
    const updatedPosts = entry?.posts.filter((p) => !p.equals(item));
    await this.dictionary.partialUpdateOne({ word }, { posts: updatedPosts });
  }

  async getEntry(word: string) {
    const entry = await this.dictionary.readOne({ word });
    return {
      entry,
    };
  }

  private async assertEntryAlreadyExists(word: string) {
    const entry = await this.dictionary.readOne({ word });
    if (entry) {
      throw new EntryAlreadyExistsError(word);
    }
  }

  public async entryExists(word: string) {
    const entry = await this.dictionary.readOne({ word });
    return entry !== null;
  }

  private async assertEntryExists(word: string) {
    const entry = await this.dictionary.readOne({ word });
    if (!entry) {
      throw new EntryNotFoundError(word);
    }
  }

  async deletePostEntrys(postId: ObjectId) {
    return await this.dictionary.deleteMany({ postId });
  }
}

export class EntryAlreadyExistsError extends NotAllowedError {
  constructor(public readonly word: string) {
    super(`Entry "${word}" already exists`);
  }
}

export class EntryNotFoundError extends NotFoundError {
  constructor(public readonly word: string) {
    super(`Entry "${word}" does not exist`);
  }
}
