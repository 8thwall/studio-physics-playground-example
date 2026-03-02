// This is a component file. You can use this file to define a custom component for your project.
// This component will appear as a custom component in the editor.

import * as ecs from '@8thwall/ecs'  // This is how you access the ecs library.

ecs.registerComponent({
  name: 'object-pickup',
  schema: {
    playerCamera: ecs.eid,
    treasureCamera: ecs.eid,
    treasureChestObj: ecs.eid,
    treasureLockObj: ecs.eid,
    treasureJewel: ecs.eid,
  },
  data: {
    isPickedUp: ecs.boolean,  // Tracks if the object has been picked up
  },
  stateMachine: ({world, eid, dataAttribute, schemaAttribute}) => {
    // Handle start of a collision
    const handleCollisionStart = () => {
      const data = dataAttribute.cursor(eid)
      const {playerCamera, treasureCamera, treasureChestObj, treasureLockObj, treasureJewel} = schemaAttribute.get(eid)

      if (!data.isPickedUp) {
        // Mark as picked up
        data.isPickedUp = true

        // Hide the object by disabling the entity
        world.getEntity(eid).disable()

        world.time.setTimeout(() => {
        // switch to chest camera
          world.camera.setActiveEid(treasureCamera)
        }, 500)

        world.time.setTimeout(() => {
        // add mass to lock so it drops
          ecs.Collider.set(world, treasureLockObj, {
            type: ecs.ColliderType.Dynamic,
            angularDamping: 0.5,
            mass: 3,
          })
          // play open animation on chest
          ecs.GltfModel.set(world, treasureChestObj, {
            animationClip: 'ChestOpen',
            paused: false,
          })

          ecs.PositionAnimation.set(world, treasureJewel, {
            fromX: 0.75,
            fromY: 3,
            fromZ: 1,
            toX: 0.75,
            toY: 4.5,
            toZ: 1,
            duration: 2000,
            loop: false,
            easeIn: true,
            easeOut: true,
          })

          ecs.RotateAnimation.set(world, treasureJewel, {
            fromX: 0,
            fromY: 0,
            fromZ: 0,
            toX: 0,
            toY: 359,
            toZ: 0,
            shortestPath: false,
            duration: 4000,
            loop: true,
          })
        }, 1000)

        world.time.setTimeout(() => {
        // switch back to player camera
          world.camera.setActiveEid(playerCamera)
        }, 5000)
      }
    }

    ecs.defineState('default').initial()
      .onEnter(() => {
        console.log('Object pickup component initialized')

        // Initialize data
        const data = dataAttribute.cursor(eid)
        data.isPickedUp = false

        // Set up collision listener
        world.events.addListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
      })
      .onExit(() => {
        // Clean up collision listener
        world.events.removeListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
      })

    // Initialize data
    dataAttribute.set(eid, {
      isPickedUp: false,
    })
  },
})
