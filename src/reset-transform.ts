import * as ecs from '@8thwall/ecs'

// Simple component that resets a target entity's transform to a fixed position (4, 5, -20)
ecs.registerComponent({
  name: 'Reset Transform',
  // --- Configuration exposed in Inspector ---
  schema: {
    // @label Reset Key
    resetKey: ecs.string,  // Input action name to trigger reset (e.g., 'reset' or 'r')
    // @label Auto Reset on Out of Bounds
    autoReset: ecs.boolean,  // Automatically reset if entity falls below resetY
    // @label Reset Y Threshold
    resetY: ecs.f32,  // Y position threshold for auto reset
  },
  // --- Default Inspector values ---
  schemaDefaults: {
    resetKey: 'reset',
    autoReset: true,
    resetY: -5,
  },
  // --- Internal state ---
  data: {
    resetTriggered: ecs.boolean,  // Prevent multiple reset calls
  },

  // --- Main logic ---
  stateMachine: ({world, eid, schemaAttribute, dataAttribute}) => {
    // Helper function to reset this entity to fixed position (4, 5, -20)
    const resetTransform = () => {
      const data = dataAttribute.cursor(eid)

      if (data.resetTriggered) return

      data.resetTriggered = true

      // Set position to fixed coordinates (4, 5, -20)
      ecs.Position.set(world, eid, {
        x: 4,
        y: 3,
        z: 17,
      })

      // Reset rotation to zero
      world.setQuaternion(eid, 0, 0, 0, 1)

      // Clear physics velocities (8th Wall handles non-physics entities gracefully)
      ecs.physics.setLinearVelocity(world, eid, 0, 0, 0)
      ecs.physics.setAngularVelocity(world, eid, 0, 0, 0)

      // Notify camera components that this entity was teleported/reset
      // This prevents the camera from interpreting the position jump as movement
      world.events.dispatch(world.events.globalId, 'entity-teleported', {
        entityId: eid,
        newPosition: {x: 4, y: 3, z: 17},
      })

      // Reset the trigger flag after a short delay
      world.time.setTimeout(() => {
        dataAttribute.cursor(eid).resetTriggered = false
      }, 100)
    }

    // Single state that handles reset logic
    ecs.defineState('active')
      .initial()
      .onEnter(() => {
        dataAttribute.cursor(eid).resetTriggered = false
      })
      .onTick(() => {
        const {resetKey, autoReset, resetY} = schemaAttribute.get(eid)

        // Check for manual reset input
        if (resetKey && world.input.getAction(resetKey)) {
          resetTransform()
          return
        }

        // Check for auto reset based on Y position
        if (autoReset) {
          const entityPos = ecs.Position.get(world, eid)
          if (entityPos && entityPos.y < resetY) {
            resetTransform()
          }
        }
      })
  },
})
