// Vehicle swap component with explicit state management
// Manages switching between ball and rocket controllers using a state machine
// Dispatches global events for controller state changes

import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'vehicle-swap',
  schema: {
    rocketButton: ecs.eid,
    beachBallButton: ecs.eid,
    // @asset
    rocketModel: ecs.string,
    // @asset
    beachBallModel: ecs.string,
  },
  stateMachine: ({world, eid, schemaAttribute}) => {
    // Define triggers for state transitions
    const switchToBall = ecs.defineTrigger()
    const switchToRocket = ecs.defineTrigger()

    // Helper function to get schema safely in callbacks
    const schema = () => schemaAttribute.get(eid)

    // ──────────────────────────────────────────────────────────────────────────
    // State: ballActive
    // The beach ball controller is active, ball model is shown
    // ──────────────────────────────────────────────────────────────────────────
    ecs.defineState('ballActive')
      .initial()
      .onEnter(() => {
        const s = schema()

        // Set the beach ball model
        if (s.beachBallModel) {
          ecs.GltfModel.set(world, eid, {
            url: s.beachBallModel,
            collider: false,
          })
          ecs.Collider.set(world, eid, {
            shape: ecs.ColliderShape.Sphere,
          })
        }

        ecs.Ui.set(world, s.rocketButton, {borderWidth: 0})
        ecs.Ui.set(world, s.beachBallButton, {borderWidth: 2})

        // Dispatch global event to notify all systems
        world.events.dispatch(world.events.globalId, 'vehicle-controller-changed', {
          controller: 'ball',
          vehicleEid: eid,
        })
      })
      .listen(
        () => schema().rocketButton,
        ecs.input.UI_CLICK,
        () => {
          switchToRocket.trigger()
        }
      )
      .onTrigger(switchToRocket, 'rocketActive')

    // ──────────────────────────────────────────────────────────────────────────
    // State: rocketActive
    // The rocket controller is active, rocket model is shown
    // ──────────────────────────────────────────────────────────────────────────
    ecs.defineState('rocketActive')
      .onEnter(() => {
        const s = schema()

        // Set the rocket model
        if (s.rocketModel) {
          ecs.GltfModel.set(world, eid, {
            url: s.rocketModel,
            collider: true,
          })
        }

        ecs.Ui.set(world, s.beachBallButton, {borderWidth: 0})
        ecs.Ui.set(world, s.rocketButton, {borderWidth: 2})

        // Dispatch global event to notify all systems
        world.events.dispatch(world.events.globalId, 'vehicle-controller-changed', {
          controller: 'rocket',
          vehicleEid: eid,
        })
      })
      .listen(
        () => schema().beachBallButton,
        ecs.input.UI_CLICK,
        () => {
          switchToBall.trigger()
        }
      )
      .onTrigger(switchToBall, 'ballActive')
  },
})
