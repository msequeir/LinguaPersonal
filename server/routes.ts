import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Dictionarying, Friending, Posting, Profiling, Sessioning, Upvoting } from "./app";
import { Dialects, UserRole } from "./concepts/profiling";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Profiling.getUserById(user);
  }

  @Router.get("/users")
  async getProfiles() {
    return await Profiling.getProfiles();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Profiling.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string, description: string, role: UserRole, dialect: Dialects) {
    Sessioning.isLoggedOut(session);
    return await Profiling.create(username, password, description, role, dialect);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Profiling.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Profiling.updatePassword(user, currentPassword, newPassword);
  }

  @Router.patch("/users/description")
  async updateDescription(session: SessionDoc, description: string) {
    const user = Sessioning.getUser(session);
    return await Profiling.updateDescription(user, description);
  }

  @Router.patch("/users/role")
  async updateRole(session: SessionDoc, role: UserRole) {
    const user = Sessioning.getUser(session);
    return await Profiling.updateRole(user, role);
  }

  @Router.patch("/users/dialect")
  async updateDialect(session: SessionDoc, dialect: Dialects) {
    const user = Sessioning.getUser(session);
    return await Profiling.updateDialect(user, dialect);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Profiling.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Profiling.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  async getPosts(id?: string) {
    if (id) {
      const oid = new ObjectId(id);
      const post = await Posting.getPost(oid);
      return Responses.post(post);
    } else {
      const posts = await Posting.getPosts();
      return Responses.posts(posts);
    }
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, word: string, translation: string, imageUrl?: string, audioUrl?: string) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, word, translation, imageUrl, audioUrl);
    await Dictionarying.addItem(word, created.post!._id);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, translation?: string, imageUrl?: string, audioUrl?: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, translation, imageUrl, audioUrl);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    const post = await Posting.getPost(oid);
    await Posting.delete(oid);
    await Dictionarying.deleteItem(post.word, oid);
    return { msg: "Post deleted successfully!" };
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Profiling.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Profiling.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Profiling.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Profiling.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Profiling.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Profiling.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  @Router.put("/upvotes/upvote/:id")
  async upvote(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const ItemOid = new ObjectId(id);
    const votes = await Upvoting.getVotes(ItemOid);
    let response;
    if (votes.votes.upvotes.has(user)) {
      response = await Upvoting.removeUpvote(ItemOid, user);
    } else {
      response = await Upvoting.upvoteItem(ItemOid, user);
    }
    return response;
  }

  @Router.put("/upvotes/downvote/:id")
  async downvote(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const ItemOid = new ObjectId(id);
    const votes = await Upvoting.getVotes(ItemOid);
    let response;
    if (votes.votes.downvotes.has(user)) {
      response = await Upvoting.removeDownvote(ItemOid, user);
    } else {
      response = await Upvoting.downvoteItem(ItemOid, user);
    }
    return response;
  }

  @Router.get("/upvotes/:id")
  async countUpvotes(id: string) {
    const ItemOid = new ObjectId(id);
    return await Upvoting.getUpvoteCount(ItemOid);
  }

  @Router.get("/downvotes/:id")
  async countDownvotes(id: string) {
    const ItemOid = new ObjectId(id);
    return await Upvoting.getDownvoteCount(ItemOid);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
