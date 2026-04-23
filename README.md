# Physics Playground

This example studio project demonstrates how to build multiple player controllers, switch between them dynamically, and integrate physics-driven gameplay with smooth camera tracking.

![Rocket ship and beach ball traversing platforms on a pirate themed island](./src/assets/preview.gif)

<details><summary>Try it out</summary>

https://8thwall.org/studio-physics-playground-example/

<img alt="QR Code for the preview link" src="https://8th.io/qr?v=2&url=https://8thwall.org/studio-physics-playground-example/" width=250 height=250 />


## Usage

1. [Install the Desktop App](https://8thwall.org/downloads)
2. On this repository, click Code > Download zip
3. Unzip the folder to the location you'd like to work in
4. In the desktop app, click "Open" and select the folder
5. Recommended: Track your files using [git](https://git-scm.com/about) to avoid losing progress

## Deployment

This project contains Github Actions configuration for deployment to Github Pages, which triggers automatically by pushing the `main` branch. You can also follow the publishing instructions here: https://8thwall.org/docs/getting-started/publishing to publish to any other web host.

## Questions?

Please raise any questions on [Github Discussions](https://github.com/orgs/8thwall/discussions) or join the [Discord](https://8th.io/discord) to connect with the community.

## Overview

Players can swap between two vehicles:

- Beach Ball - a rolling ball with classic movement and jump mechanics.
- Rocket - a thrust-based vehicle with tilt, stabilization, and directional boosters.

## Controls

- WASD / Arrow Keys - Movement
- Space - Jump (Ball) / Thrust (Rocket)
- Shift - Stabilize (Rocket)
- UI Buttons - Switch between Beach Ball and Rocket

## Components

### vehicle-swap

The vehicleSwap component manages switching between the ball and rocket controllers. It updates active states, swaps models, and dispatches global events so systems stay in sync.

Schema:

- rocketButton: UI element for selecting the rocket
- beachBallButton: UI element for selecting the ball
- rocketModel: Asset path for rocket model
- beachBallModel: Asset path for beach ball model

State Machine:

- ballActive: Ball model is shown, ball controller enabled
- rocketActive: Rocket model is shown, rocket controller enabled

### ballController

The ballController enables rolling physics and jump mechanics. It supports both direct movement and torque-based control for variety.

Schema:

- force: Movement force applied per input
- jumpForce: Impulse force applied when jumping
- jumpControlFactor: Air control multiplier
- torqueForce: Additional torque applied when modifier is held

Data:

- isGrounded: True if in contact with surface
- collisionCount: Number of active collisions
- velocityX / velocityZ: Tracked movement speed
- isActive: Whether the ball controller is currently active

The rocketController simulates thrust-based flight and tilt controls with optional stabilization. Particle systems toggle with thrust input for visual feedback.

Schema:

- torqueStrength: Rotation force applied by tilt input
- mainThrustForce: Upward lift from main booster
- lateralThrustForce: Side thrust for precision movement
- rotationDamping: Dampens angular velocity for stability
- maxTiltAngle: Tilt limit in radians

Data:

- isGrounded: True if rocket is touching ground
- collisionCount: Active collisions count
- velocityX / velocityZ: Horizontal speed tracking
- isThrusting: Whether thrust is active
- isActive: Whether rocket controller is active
- quaternion (x,y,z,w): Stores current rotation

## Input Manager

The Input Manager maps multiple input methods into unified actions:

- forward — W / Up arrow / gamepad stick up
- backward — S / Down arrow / gamepad stick down
- left — A / Left arrow / gamepad stick left
- right — D / Right arrow / gamepad stick right
- jump — Space bar
- modify — Shift (used for rocket stabilization and ball torque mode)

## Asset Attribution

[Pirate Kit](https://quaternius.com/packs/piratekit.html) By Quaternius,
[Pirate Kit](https://kenney.nl/assets/pirate-kit) By Kenney,
[Chest Game Asset Animated](https://sketchfab.com/3d-models/chest-game-asset-animated-ca26393a972c49ba80f7de01f04b9edb) By Johnny Rogue
