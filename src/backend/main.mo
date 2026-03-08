import Blob "mo:core/Blob";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import List "mo:core/List";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Set "mo:core/Set";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type MessageType = {
    #text : Text;
    #audio : Blob;
  };

  type UserProfile = {
    username : Text;
    createdAt : Time.Time;
  };

  type Message = {
    sender : Principal;
    recipient : Principal;
    content : MessageType;
    timestamp : Time.Time;
    isRead : Bool;
    isDeleted : Bool;
  };

  type Conversation = {
    withUser : Principal;
    messages : [Message];
    unreadCount : Nat;
  };

  module Conversation {
    public func compare(convo1 : Conversation, convo2 : Conversation) : Order.Order {
      Nat.compare(convo2.unreadCount, convo1.unreadCount);
    };

    public func compareByUser(convo1 : Conversation, convo2 : Conversation) : Order.Order {
      Principal.compare(convo1.withUser, convo2.withUser);
    };
  };

  let users = Map.empty<Principal, UserProfile>();
  let messages = List.empty<Message>();

  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public shared ({ caller }) func registerUser(username : Text) : async Text {
    if (username.size() < 3 or username.size() > 16) {
      Runtime.trap("Username must be between 3 and 16 characters");
    };
    switch (users.get(caller)) {
      case (?_) { Runtime.trap("User already registered") };
      case (null) {};
    };
    users.add(
      caller,
      {
        username;
        createdAt = Time.now();
      },
    );
    // Assign user role upon registration
    AccessControl.assignRole(accessControlState, caller, caller, #user);
    "User registered successfully";
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    users.get(caller);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    users.add(caller, profile);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    users.get(user);
  };

  public query ({ caller }) func getAllUsers() : async [UserProfile] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list all users");
    };
    users.values().toArray().sort(
      func(a, b) { Text.compare(a.username, b.username) }
    );
  };

  public shared ({ caller }) func sendMessage(recipient : Principal, content : MessageType) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can send messages");
    };
    let _ = switch (content) {
      case (#text(text)) {
        if (text.isEmpty()) {
          Runtime.trap("Message cannot be empty");
        };
      };
      case (_) {};
    };
    if (not users.containsKey(recipient)) {
      Runtime.trap("Recipient not found");
    };
    if (caller == recipient) {
      Runtime.trap("Cannot send message to yourself");
    };

    messages.add({
      sender = caller;
      recipient;
      content;
      timestamp = Time.now();
      isRead = false;
      isDeleted = false;
    });
    "Message sent successfully";
  };

  public query ({ caller }) func getConversation(withUser : Principal) : async Conversation {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view conversations");
    };
    let convoMessages = messages.filter(
      func(m) {
        (m.sender == caller and m.recipient == withUser) or (m.sender == withUser and m.recipient == caller);
      }
    );
    let unreadCount = convoMessages.filter(
      func(m) { m.sender == withUser and m.recipient == caller and not m.isRead }
    ).size();
    {
      withUser;
      messages = convoMessages.toArray();
      unreadCount;
    };
  };

  public query ({ caller }) func listConversations() : async [Conversation] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list conversations");
    };
    let filteredMessages = messages.toArray().filter(
      func(m) { m.sender == caller or m.recipient == caller }
    );
    let conversationsByUser = Map.empty<Principal, List.List<Message>>();

    for (msg in filteredMessages.values()) {
      let otherUser = if (msg.sender == caller) { msg.recipient } else { msg.sender };
      let existing = switch (conversationsByUser.get(otherUser)) {
        case (null) { List.empty<Message>() };
        case (?msgs) { msgs };
      };
      existing.add(msg);
      conversationsByUser.add(otherUser, existing);
    };

    let conversations = conversationsByUser.map<Principal, List.List<Message>, Conversation>(
      func(withUser, msgs) {
        let unreadCount = msgs.filter(
          func(m) { m.sender == withUser and m.recipient == caller and not m.isRead }
        ).size();
        let messagesArray = msgs.values().toArray();
        {
          withUser;
          messages = messagesArray;
          unreadCount;
        };
      }
    );

    conversations.values().toArray().sort();
  };

  public shared ({ caller }) func markAsRead(withUser : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can mark messages as read");
    };
    let updatedMessages = messages.map<Message, Message>(
      func(msg) {
        if (msg.sender == withUser and msg.recipient == caller) {
          { msg with isRead = true };
        } else {
          msg;
        };
      }
    );
    messages.clear();
    messages.addAll(updatedMessages.values());
  };

  public query ({ caller }) func getAllMessages() : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all messages");
    };
    messages.toArray();
  };
};
